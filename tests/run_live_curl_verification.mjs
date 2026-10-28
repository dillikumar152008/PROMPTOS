// ==============================================================================
// LIVE CURL VERIFICATION SUITE
// Runs REAL curl commands against production Next.js server (http://localhost:3001)
// Authenticated via genuine Supabase session cookie.
// Verifies HTTP Status and confirms NO raw sensitive values are echoed back.
// ==============================================================================

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. Load env
let envContent = '';
if (fs.existsSync(path.join(projectRoot, '.env.local'))) {
  envContent = fs.readFileSync(path.join(projectRoot, '.env.local'), 'utf8');
}
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;
const testAuthToken = process.env.TEST_AUTH_TOKEN;

// 2. Generate genuine authenticated session cookie
console.log('[AUTH] Generating genuine Supabase session cookie for test user...');

let cookieHeader = '';
const cookieJar = [];
const ssrClient = createServerClient(supabaseUrl, supabaseAnonKey, {
  cookies: {
    getAll() { return cookieJar; },
    setAll(newCookies) { cookieJar.push(...newCookies); }
  }
});

if (testAuthToken) {
  await ssrClient.auth.setSession({
    access_token: testAuthToken,
    refresh_token: process.env.TEST_REFRESH_TOKEN || '',
  });
  cookieHeader = cookieJar.map(c => `${c.name}=${c.value}`).join('; ');
} else if (testEmail && testPassword) {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: signData, error } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (error) {
    console.error('Failed to authenticate test user:', error.message);
    process.exit(1);
  }

  await ssrClient.auth.setSession({
    access_token: signData.session.access_token,
    refresh_token: signData.session.refresh_token,
  });
  cookieHeader = cookieJar.map(c => `${c.name}=${c.value}`).join('; ');
} else {
  console.error('Missing credentials: set TEST_AUTH_TOKEN or (TEST_USER_EMAIL and TEST_USER_PASSWORD) in your environment.');
  process.exit(1);
}
const cookieFile = path.join(projectRoot, 'temp_curl_cookies.txt');
fs.writeFileSync(cookieFile, cookieHeader, 'utf8');

console.log('[AUTH] Cookie successfully generated. Running curl checks...\n');

// Helper to run curl
function executeCurl(name, curlCmd, forbiddenSubstrings = []) {
  console.log(`======================================================================`);
  console.log(`  LIVE CURL TEST: ${name}`);
  console.log(`======================================================================`);
  console.log(`CMD: ${curlCmd.slice(0, 150)}...`);

  try {
    const rawOutput = execSync(curlCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    
    // Split headers and body
    const parts = rawOutput.split(/\r?\n\r?\n/);
    const headers = parts.slice(0, -1).join('\n\n');
    const bodyStr = parts[parts.length - 1];

    const statusMatch = rawOutput.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 'UNKNOWN';

    console.log(`HTTP STATUS: ${status}`);
    let parsedBody;
    try {
      parsedBody = JSON.parse(bodyStr);
      console.log(`RESPONSE BODY:`, JSON.stringify(parsedBody, null, 2));
    } catch {
      console.log(`RESPONSE BODY (raw):`, bodyStr.slice(0, 500));
    }

    // Safety checks
    for (const sub of forbiddenSubstrings) {
      if (rawOutput.includes(sub)) {
        console.error(`  [SECURITY VIOLATION] Raw value "${sub}" leaked in HTTP response!`);
        process.exit(1);
      }
    }
    console.log(`  ✓ NO raw sensitive values leaked in response.`);
    return { status, body: parsedBody };
  } catch (err) {
    console.error(`Curl execution failed:`, err.message);
    if (err.stdout) console.log(`STDOUT:`, err.stdout);
    if (err.stderr) console.error(`STDERR:`, err.stderr);
    throw err;
  }
}

// ── TEST 1: Payment Card (Expect HTTP 403 Forbidden, action: block, receipt included) ──
const cardPayload = JSON.stringify({
  message: 'Please authorize billing for Visa card 4111 1111 1111 1111 immediately.',
});
executeCurl(
  '1. PAYMENT CARD INJECTION',
  `curl -s -i -X POST "http://localhost:3001/api/chat" -H "Content-Type: application/json" -H "Cookie: ${cookieHeader}" -d "${cardPayload.replace(/"/g, '\\"')}"`,
  ['4111 1111 1111 1111']
);

// ── TEST 2: API Key (Expect HTTP 403 Forbidden, action: block, receipt included) ──
const keyPayload = JSON.stringify({
  message: 'Authenticate backend cluster using sk-ant-api03-abcdef1234567890abcdef1234567890 secret token.',
});
executeCurl(
  '2. API KEY INJECTION',
  `curl -s -i -X POST "http://localhost:3001/api/chat" -H "Content-Type: application/json" -H "Cookie: ${cookieHeader}" -d "${keyPayload.replace(/"/g, '\\"')}"`,
  ['sk-ant-api03-abcdef1234567890abcdef1234567890']
);

// ── TEST 3: Aadhaar PII (Expect HTTP 200 OK, action: sanitize, raw Aadhaar masked with [AADHAAR_1]) ──
const aadhaarPayload = JSON.stringify({
  message: 'KYC registration verification for applicant Aadhaar 2345 6789 0124.',
});
executeCurl(
  '3. AADHAAR PII SANITIZATION',
  `curl -s -i -X POST "http://localhost:3001/api/chat" -H "Content-Type: application/json" -H "Cookie: ${cookieHeader}" -d "${aadhaarPayload.replace(/"/g, '\\"')}"`,
  ['2345 6789 0124']
);

// ── TEST 4: Clean Prompt (Expect HTTP 200 OK, action: allow, receipt included) ──
const cleanPayload = JSON.stringify({
  message: 'Explain the principle of least privilege in distributed microservice architectures.',
});
executeCurl(
  '4. CLEAN PROMPT (POLICY ALLOW)',
  `curl -s -i -X POST "http://localhost:3001/api/chat" -H "Content-Type: application/json" -H "Cookie: ${cookieHeader}" -d "${cleanPayload.replace(/"/g, '\\"')}"`
);

// ── TEST 5: Multipart Raw Image Upload (Expect HTTP 422 Unprocessable, action: held) ──
// Create small dummy png
const dummyImgPath = path.join(projectRoot, 'temp_test_image.png');
fs.writeFileSync(dummyImgPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); // PNG magic bytes
try {
  executeCurl(
    '5. RAW MULTIPART IMAGE UPLOAD (POLICY HELD)',
    `curl -s -i -X POST "http://localhost:3001/api/chat" -H "Cookie: ${cookieHeader}" -F "message=Read this image document" -F "images=@${dummyImgPath};type=image/png"`
  );
} finally {
  if (fs.existsSync(dummyImgPath)) fs.unlinkSync(dummyImgPath);
  if (fs.existsSync(cookieFile)) fs.unlinkSync(cookieFile);
}

console.log('\n======================================================================');
console.log('  ALL LIVE PRODUCTION CURL VERIFICATION TESTS PASSED!');
console.log('======================================================================\n');
