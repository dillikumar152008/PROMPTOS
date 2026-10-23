import {
  MAX_IMAGE_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
  MAX_SINGLE_IMAGE_BYTES,
  ALLOWED_IMAGE_MIMES,
  ATTACHMENT_RATE_LIMIT_WINDOW_MS,
  MAX_ATTACHMENT_REQUESTS_PER_MINUTE,
} from './config.js';
import { prepareMessage } from '../chat/prepare.js';

export function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'attachment';
  const basename = name.split(/[/\\]/).pop() || 'attachment';
  const clean = basename
    .replace(/[^\w.-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);
  const safeName = clean || 'attachment';
  return prepareMessage(safeName);
}

export function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP: "RIFF" at 0..3 and "WEBP" at 8..11
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

export async function validateImageFiles(files) {
  if (!files || files.length === 0) {
    return { valid: true, images: [] };
  }

  if (files.length > MAX_IMAGE_COUNT) {
    return {
      valid: false,
      error: `You can upload at most ${MAX_IMAGE_COUNT} images per message.`,
      images: [],
    };
  }

  let totalBytes = 0;
  const validatedImages = [];

  for (const file of files) {
    totalBytes += file.size;
    if (file.size > MAX_SINGLE_IMAGE_BYTES) {
      return {
        valid: false,
        error: `File "${sanitizeFilename(file.name)}" exceeds the 3.5 MB size limit.`,
        images: [],
      };
    }

    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return {
        valid: false,
        error: 'Total attachments exceed the 3.5 MB per-message limit.',
        images: [],
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const detectedMime = detectImageMime(buffer);

    if (!detectedMime || !ALLOWED_IMAGE_MIMES.includes(detectedMime)) {
      return {
        valid: false,
        error: `File "${sanitizeFilename(file.name)}" is not a valid PNG, JPG, or WEBP image.`,
        images: [],
      };
    }

    validatedImages.push({
      filename: sanitizeFilename(file.name),
      mimeType: detectedMime,
      buffer,
      size: file.size,
    });
  }

  return {
    valid: true,
    images: validatedImages,
  };
}

const attachmentTimestamps = new Map();

export function checkAttachmentRateLimit(userId) {
  const now = Date.now();
  const timestamps = attachmentTimestamps.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < ATTACHMENT_RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_ATTACHMENT_REQUESTS_PER_MINUTE) {
    attachmentTimestamps.set(userId, validTimestamps);
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  attachmentTimestamps.set(userId, validTimestamps);
  return { allowed: true, remaining: MAX_ATTACHMENT_REQUESTS_PER_MINUTE - validTimestamps.length };
}
