// ==============================================================================
// SYNTHETIC TEST SUITE: ALL DATA BELOW IS 100% SYNTHETIC AND FOR TESTING ONLY.
// ZERO REAL PERSONAL DATA, PASSWORDS, OR SECRETS ARE STORED OR TESTED.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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

async function run() {
  console.log('\n======================================================');
  console.log('   PROMPTOS ROUTE & MIDDLEWARE HTTP CURL VERIFICATION');
  console.log('======================================================\n');

  const BASE_URL = 'http://localhost:3000';

  if (!testEmail || !testPassword) {
    console.log('[SKIP] TEST_EMAIL or TEST_PASSWORD not set. Please set TEST_EMAIL and TEST_PASSWORD in .env.local to run authenticated curl verification.');
    process.exit(0);
  }

  // 1. Authenticate with Supabase to get an authenticated session token/cookies
  const supabase = createClient(supabaseUrl, anonKey);
  const { data: authData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginErr || !authData.session) {
    console.error('Failed to log in for auth testing:', loginErr?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  // Construct standard Supabase auth cookies
  const authHeader = `Bearer ${token}`;
  const authCookie = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token=${JSON.stringify(authData.session)}`;

  console.log('[SECTION 1] Legacy Paths - Unauthenticated (Expect 404 Not Found)');
  const legacyPaths = [
    '/api/apps/a.b',
    '/api/apps/a.b/run',
    '/api/apps/a.b/access',
    '/app/a.b',
    '/api/creator/x.y',
    '/api/user/x.y',
    '/api/apps/',
    '/APP/demo',
    '/api/apps',
    '/api/apps/123/run',
    '/api/creator/analytics',
    '/api/creator/generate-app',
    '/api/user/unlocked-apps',
    '/app/demo',
  ];

  for (const p of legacyPaths) {
    const res = await fetch(`${BASE_URL}${p}`);
    console.log(`  curl ${p} -> Status: ${res.status} ${res.statusText}`);
    if (res.status !== 404) {
      console.error(`  FAIL: Expected 404 but got ${res.status} for ${p}`);
      process.exit(1);
    }
  }

  console.log('\n[SECTION 2] Legacy Paths - Authenticated with User Session (Expect 404 Not Found)');
  for (const p of legacyPaths) {
    const res = await fetch(`${BASE_URL}${p}`, {
      headers: {
        Authorization: authHeader,
        Cookie: authCookie,
      },
    });
    console.log(`  curl (auth) ${p} -> Status: ${res.status} ${res.statusText}`);
    if (res.status !== 404) {
      console.error(`  FAIL: Expected 404 for authenticated user on ${p}`);
      process.exit(1);
    }
  }

  console.log('\n[SECTION 3] Active Non-Legacy Paths (Expect Normal Functionality)');
  // a. /login should return 200 OK
  const loginRes = await fetch(`${BASE_URL}/login`);
  console.log(`  curl /login -> Status: ${loginRes.status} (Expected 200)`);
  if (loginRes.status !== 200) process.exit(1);

  // b. /chat unauthenticated should return 307 redirect to /login
  const chatUnauthRes = await fetch(`${BASE_URL}/chat`, { redirect: 'manual' });
  console.log(`  curl /chat (unauth) -> Status: ${chatUnauthRes.status} Location: ${chatUnauthRes.headers.get('location')} (Expected 307 redirect to /login)`);
  if (chatUnauthRes.status !== 307) process.exit(1);

  // c. /api/chat unauthenticated should return 401 Unauthorized (Not 404)
  const apiChatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'test' }),
  });
  console.log(`  curl POST /api/chat (unauth) -> Status: ${apiChatRes.status} (Expected 401 Unauthorized)`);
  if (apiChatRes.status !== 401) process.exit(1);

  // d. /api/auth/callback should not be 404
  const authCallbackRes = await fetch(`${BASE_URL}/api/auth/callback`, { redirect: 'manual' });
  console.log(`  curl /api/auth/callback -> Status: ${authCallbackRes.status} (Expected 307 redirect to /login or /chat, NOT 404)`);
  if (authCallbackRes.status === 404) process.exit(1);

  console.log('\n======================================================');
  console.log('ALL CURL VERIFICATIONS PASSED: 100% of legacy routes return 404, active routes work.');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('Curl test error:', err);
  process.exit(1);
});
