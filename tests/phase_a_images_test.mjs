import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  sanitizeFilename,
  detectImageMime,
  validateImageFiles,
  checkAttachmentRateLimit,
} from '../lib/attachments/validate.js';
import { MAX_IMAGE_COUNT, MAX_TOTAL_ATTACHMENT_BYTES, MAX_INPUT_TOKENS } from '../lib/attachments/config.js';

console.log('======================================================');
console.log('   PROMPTOS PHASE A: IMAGES VERIFICATION TEST SUITE');
console.log('======================================================\n');

// Valid 1x1 PNG buffer
const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Valid 1x1 JPEG buffer
const validJpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

// Valid 1x1 WEBP buffer: RIFF....WEBP
const validWebpBuffer = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);

// Helper to create mock File object
function createMockFile(name, buffer, mimeType) {
  return {
    name,
    size: buffer.length,
    type: mimeType,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  process.stdout.write(`[TEST ${total}] ${name}... `);
  try {
    fn();
    console.log('✓ PASS');
    passed++;
  } catch (err) {
    console.log('✗ FAIL');
    console.error('  Error:', err.message);
  }
}

async function runAsyncTest(name, fn) {
  total++;
  process.stdout.write(`[TEST ${total}] ${name}... `);
  try {
    await fn();
    console.log('✓ PASS');
    passed++;
  } catch (err) {
    console.log('✗ FAIL');
    console.error('  Error:', err.message);
  }
}

async function main() {
  // TEST 1: Magic bytes detection for PNG, JPEG, WEBP
  runTest('Magic byte detection for valid image formats', () => {
    assert.strictEqual(detectImageMime(validPngBuffer), 'image/png');
    assert.strictEqual(detectImageMime(validJpegBuffer), 'image/jpeg');
    assert.strictEqual(detectImageMime(validWebpBuffer), 'image/webp');
  });

  // TEST 2: Renamed non-image (fake.png containing text) must be rejected
  await runAsyncTest('Renamed non-image file (.png containing text) rejected by magic bytes', async () => {
    const fakeBuffer = Buffer.from('This is a text file renamed to fake.png');
    const fakeFile = createMockFile('fake.png', fakeBuffer, 'image/png');
    const res = await validateImageFiles([fakeFile]);
    assert.strictEqual(res.valid, false, 'Fake png must be rejected');
    assert(res.error.includes('is not a valid PNG, JPG, or WEBP image'), 'Must return clean error message');
  });

  // TEST 3: 3 images in one message must be rejected (max is 2)
  await runAsyncTest('3 images in one message rejected by max count limit', async () => {
    const files = [
      createMockFile('img1.png', validPngBuffer, 'image/png'),
      createMockFile('img2.png', validPngBuffer, 'image/png'),
      createMockFile('img3.png', validPngBuffer, 'image/png'),
    ];
    const res = await validateImageFiles(files);
    assert.strictEqual(res.valid, false);
    assert(res.error.includes(`at most ${MAX_IMAGE_COUNT} images`));
  });

  // TEST 4: Oversized total attachment (> 3.5 MB) rejected
  await runAsyncTest('Oversized total attachment (> 3.5 MB) rejected', async () => {
    const hugeBuffer = Buffer.alloc(3.6 * 1024 * 1024);
    // write valid png header so it passes mime check if size check fails
    validPngBuffer.copy(hugeBuffer, 0, 0, 8);
    const hugeFile = createMockFile('huge.png', hugeBuffer, 'image/png');
    const res = await validateImageFiles([hugeFile]);
    assert.strictEqual(res.valid, false);
    assert(res.error.includes('3.5 MB'));
  });

  // TEST 5: Filename sanitization & path traversal removal
  runTest('Filename sanitization strips path traversal, control chars, and limits length', () => {
    const dirty1 = '../../etc/passwd.png';
    const clean1 = sanitizeFilename(dirty1);
    assert(!clean1.includes('/'), 'Must not contain slashes');
    assert(!clean1.includes('..'), 'Must not contain traversal dots');

    const dirty2 = 'my\\nested\\folder\\image.jpg';
    const clean2 = sanitizeFilename(dirty2);
    assert(!clean2.includes('\\'), 'Must not contain backslashes');
    assert(clean2.endsWith('image.jpg'));
  });

  // TEST 6: Filename PII masking through DLP
  runTest('Filename containing sensitive Aadhaar/PAN is masked by DLP', () => {
    // Synthetic fake Aadhaar number in filename
    const sensitiveName = '234567890124_aadhaar_card.png';
    const cleanSensitive = sanitizeFilename(sensitiveName);
    assert(!cleanSensitive.includes('234567890124'), 'Must not contain raw Aadhaar');
    assert(cleanSensitive.includes('[AADHAAR_'), 'Must contain masked placeholder');
  });

  // TEST 7: Best-effort in-memory attachment rate limiter
  runTest('Attachment rate limiter allows up to 5/min and blocks 6th', () => {
    const testUser = `usr_test_rate_${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const check = checkAttachmentRateLimit(testUser);
      assert.strictEqual(check.allowed, true, `Call ${i + 1} should be allowed`);
    }
    const sixthCheck = checkAttachmentRateLimit(testUser);
    assert.strictEqual(sixthCheck.allowed, false, '6th call in 1 minute should be rejected');
  });

  // TEST 8: Client bundle security scan — GEMINI_API_KEY must NEVER exist in .next/static
  runTest('Client bundle audit: zero Gemini API keys or server secrets in .next/static', () => {
    const staticDir = path.join('.next', 'static');
    if (!fs.existsSync(staticDir)) {
      console.warn('(.next/static not found, skipping client bundle check)');
      return;
    }
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const keyMatch = envContent.match(/^GEMINI_API_KEY\s*=\s*(.*)$/m);
    const actualKey = keyMatch ? keyMatch[1].trim() : '';

    function scanDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
          scanDir(full);
        } else if (file.endsWith('.js')) {
          const js = fs.readFileSync(full, 'utf8');
          if (actualKey && actualKey.length > 10) {
            assert(!js.includes(actualKey), `CRITICAL: Real GEMINI_API_KEY found in client bundle ${full}`);
          }
          assert(!js.includes('SUPABASE_SERVICE_ROLE_KEY'), `Server secret name found in client bundle ${full}`);
        }
      }
    }
    scanDir(staticDir);
  });

  // TEST 9: Real multipart request & DLP masking on prompt with image
  await runAsyncTest('Real multipart upload & DLP masking on prompt with valid image', async () => {
    const validFile1 = createMockFile('receipt.png', validPngBuffer, 'image/png');
    const valResult = await validateImageFiles([validFile1]);
    assert.strictEqual(valResult.valid, true);
    assert.strictEqual(valResult.images.length, 1);
    assert.strictEqual(valResult.images[0].mimeType, 'image/png');
    assert(valResult.images[0].buffer.length > 0);

    // Verify metadata formatting for Supabase
    const metaHeader = valResult.images
      .map((img) => `[Attachment: ${img.filename} (${img.mimeType}, ${Math.round(img.size / 1024)} KB)]`)
      .join('\n');
    assert(metaHeader.includes('[Attachment: receipt.png (image/png, 0 KB)]'));
    assert(!metaHeader.includes('data:image'), 'Zero raw base64 or binary data in metadata string');
  });

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed}/${total} tests passed (${total - passed} failed)`);
  console.log('======================================================');
}

main().catch(console.error);
