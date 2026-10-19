// ==============================================================================
// SYNTHETIC TEST SUITE: ALL DATA BELOW IS 100% SYNTHETIC AND FOR TESTING ONLY.
// ZERO REAL PERSONAL DATA, PASSWORDS, OR SECRETS ARE STORED OR TESTED.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { scanPrompt, maskPrompt, restorePlaceholders, summarize } from '../src/lib/dlp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env.local');

const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
let testEmail = process.env.TEST_EMAIL || '';
let testPassword = process.env.TEST_PASSWORD || '';

for (const line of envContent.split(/\r?\n/)) {
  const t = line.trim();
  if (t.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = t.slice('NEXT_PUBLIC_SUPABASE_URL='.length).replace(/^['"]|['"]$/g, '');
  if (t.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) anonKey = t.slice('NEXT_PUBLIC_SUPABASE_ANON_KEY='.length).replace(/^['"]|['"]$/g, '');
  if (t.startsWith('TEST_EMAIL=')) testEmail = t.slice('TEST_EMAIL='.length).replace(/^['"]|['"]$/g, '');
  if (t.startsWith('TEST_PASSWORD=')) testPassword = t.slice('TEST_PASSWORD='.length).replace(/^['"]|['"]$/g, '');
}

if (!testEmail || !testPassword) {
  console.log('[SKIP] TEST_EMAIL or TEST_PASSWORD not set. Please set TEST_EMAIL and TEST_PASSWORD in .env.local to run live login verification.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, anonKey);

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${name} ${details ? `(${details})` : ''}`);
  }
}

console.log('\n======================================================');
console.log('   PROMPTOS PRODUCTION BUILD VERIFICATION (next start)');
console.log('======================================================\n');

async function run() {
  // 1. Unauthenticated route check
  console.log('[TEST 1] Testing unauthenticated route guard against production build...');
  const unauthRes = await fetch('http://localhost:3000/chat', { redirect: 'manual' });
  assert(unauthRes.status === 307, 'Unauthenticated /chat returns 307 redirect');
  const location = unauthRes.headers.get('location') || '';
  assert(location.includes('/login?next=%2Fchat'), 'Redirect location contains /login?next=%2Fchat');

  // 2. Login authentication
  console.log('\n[TEST 2] Testing real Supabase authentication (login)...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  assert(!authError && !!authData?.session, 'Sign in succeeds with TEST_EMAIL');
  const session = authData?.session;
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

  // Supabase Auth session cookie for Next.js SSR (@supabase/ssr)
  const sessionJson = JSON.stringify(session);
  const base64Cookie = `base64-${Buffer.from(sessionJson).toString('base64')}`;
  const cookieHeader = `sb-${projectRef}-auth-token=${base64Cookie}`;

  // 3. Authenticated /chat access
  console.log('\n[TEST 3] Testing authenticated /chat route against production build...');
  const authChatRes = await fetch('http://localhost:3000/chat', {
    headers: { Cookie: cookieHeader },
  });
  assert(authChatRes.status === 200, 'Authenticated /chat returns 200 OK');

  // 4. Client-side DLP live scanning & warning summary
  console.log('\n[TEST 4] Testing DLP Scanner & Warning Banner with synthetic data...');
  const fakeAadhaar = '2345 6789 0124';
  const fakePan = 'ABCPE1234F';
  const fakeMobile = '+91 98765 43210';
  const fakeCard = '4111 1111 1111 1111';
  const fakeApiKey = 'sk-' + 'SYNTHETIC-DUMMY-API-KEY-FOR-TESTING-001';

  const syntheticPrompt = `Hello PromptOS, here is my test info: Aadhaar ${fakeAadhaar}, PAN ${fakePan}, Mobile ${fakeMobile}, Card ${fakeCard}, Key ${fakeApiKey}. Please reply with a short summary.`;

  const findings = scanPrompt(syntheticPrompt);
  assert(findings.length === 5, 'scanPrompt detects all 5 synthetic sensitive data items');

  const summary = summarize(findings);
  assert(summary.length === 5, 'DLP banner summary contains 5 warning categories');
  assert(summary.some(s => s.type === 'AADHAAR'), 'Banner summary includes Aadhaar');
  assert(summary.some(s => s.type === 'PAN'), 'Banner summary includes PAN');
  assert(summary.some(s => s.type === 'PHONE'), 'Banner summary includes Phone');
  assert(summary.some(s => s.type === 'CARD'), 'Banner summary includes Card');
  assert(summary.some(s => s.type === 'API_KEY'), 'Banner summary includes API key');

  // 5. Client-side Masking
  console.log('\n[TEST 5] Testing Client Masking before sending to server...');
  const { masked, map } = maskPrompt(syntheticPrompt, findings);
  assert(!masked.includes(fakeAadhaar), 'Masked text contains NO raw Aadhaar');
  assert(!masked.includes(fakePan), 'Masked text contains NO raw PAN');
  assert(!masked.includes(fakeMobile), 'Masked text contains NO raw Mobile');
  assert(!masked.includes(fakeCard), 'Masked text contains NO raw Card');
  assert(!masked.includes(fakeApiKey), 'Masked text contains NO raw API Key');
  assert(masked.includes('[AADHAAR_1]') && masked.includes('[CARD_1]'), 'Masked text contains tokenized placeholders');

  // 6. Live /api/chat execution against production server
  console.log('\n[TEST 6] Sending message to production /api/chat endpoint...');
  const chatApiRes = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({ message: syntheticPrompt }), // Send prompt; server prepareMessage() also enforces masking
  });

  assert(chatApiRes.status === 200, `POST /api/chat returns 200 OK (status: ${chatApiRes.status})`);
  const chatData = await chatApiRes.json();
  assert(!!chatData?.conversationId, 'Response includes persistent conversationId');
  assert(!!chatData?.output, 'Response includes AI generated output');

  // Assert server output contains no raw PII
  assert(!chatData.output.includes(fakeAadhaar), 'Server output contains NO raw Aadhaar');
  assert(!chatData.output.includes(fakePan), 'Server output contains NO raw PAN');
  assert(!chatData.output.includes(fakeMobile), 'Server output contains NO raw Mobile');
  assert(!chatData.output.includes(fakeCard), 'Server output contains NO raw Card');
  assert(!chatData.output.includes(fakeApiKey), 'Server output contains NO raw API Key');

  // 7. Client-side Browser Response Restoration
  console.log('\n[TEST 7] Testing Browser-side Response Restoration with in-memory map...');
  // Simulate AI referencing placeholders or echoing back placeholders
  const simulatedAiOutputWithPlaceholders = `Processed customer record with Aadhaar [AADHAAR_1], PAN [PAN_1], and Mobile [PHONE_1].`;
  const restored = restorePlaceholders(simulatedAiOutputWithPlaceholders, map);
  assert(restored.includes(fakeAadhaar), 'Browser restores Aadhaar for display');
  assert(restored.includes(fakePan), 'Browser restores PAN for display');
  assert(restored.includes(fakeMobile), 'Browser restores Mobile for display');

  console.log('\n======================================================');
  console.log(`PRODUCTION TEST SUMMARY: ${passed}/${total} passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Production verification failed:', err);
  process.exit(1);
});
