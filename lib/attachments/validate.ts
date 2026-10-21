import {
  MAX_IMAGE_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
  MAX_SINGLE_IMAGE_BYTES,
  ALLOWED_IMAGE_MIMES,
} from './config';
import { prepareMessage } from '@/lib/chat/prepare';

export interface ValidatedImage {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  images: ValidatedImage[];
}

/**
 * Strips path traversal characters, directory separators, control chars, and caps length.
 * Runs through DLP prepareMessage so sensitive numbers in filenames are masked.
 * Never logs raw or sanitized filenames.
 */
export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') return 'attachment';
  // Extract basename, strip illegal characters
  const basename = name.split(/[/\\]/).pop() || 'attachment';
  const clean = basename
    .replace(/[^\w.-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);
  const safeName = clean || 'attachment';
  return prepareMessage(safeName);
}

/**
 * Inspects real magic bytes of buffer to detect genuine image format.
 * Never trusts file extension or client-supplied Content-Type.
 */
export function detectImageMime(buffer: Buffer): string | null {
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

/**
 * Validates an array of uploaded image files.
 * Rejects oversized, invalid magic bytes, or malformed files.
 */
export async function validateImageFiles(files: File[]): Promise<ImageValidationResult> {
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
  const validatedImages: ValidatedImage[] = [];

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

    if (!detectedMime || !ALLOWED_IMAGE_MIMES.includes(detectedMime as any)) {
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
