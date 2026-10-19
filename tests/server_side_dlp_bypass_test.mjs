// ==============================================================================
// SYNTHETIC TEST SUITE: ALL DATA BELOW IS 100% SYNTHETIC AND FOR TESTING ONLY.
// ZERO REAL PERSONAL DATA, PASSWORDS, OR SECRETS ARE STORED OR TESTED.
// ==============================================================================

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prepareMessage, extractMaxIndices } from '../lib/chat/prepare.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

console.log('\n======================================================');
console.log('   PROMPTOS SERVER-SIDE DLP BYPASS TEST');
console.log('   (Raw message sent directly to /api/chat bypassing client)');
console.log('======================================================\n');

// 1. Transpile route handler for direct in-memory execution with inspection hooks
const routePath = path.join(projectRoot, 'app/api/chat/route.ts');
const routeSource = fs.readFileSync(routePath, 'utf8');

const transpiled = ts.transpileModule(routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

// 2. Synthetic sensitive data (All synthetic, zero real personal data or credentials)
const rawAadhaar = '2345 6789 0124';
const rawPan = 'ABCPE1234F';
const rawPhone = '+91 98765 43210';
const rawCard = '4111 1111 1111 1111';
const rawApiKey = 'sk-' + 'SYNTHETIC-DUMMY-API-KEY-FOR-TESTING-001';

let capturedGeminiContents = null;
const capturedDbRows = [];

class MockGoogleGenAI {
  constructor(opts) {
    this.apiKey = opts.apiKey;
    this.models = {
      generateContent: async (args) => {
        capturedGeminiContents = args.contents;
        // Even if model echoes back sensitive strings
        return {
          text: `Model reply referencing Aadhaar ${rawAadhaar} and PAN ${rawPan}`,
        };
      },
    };
  }
}

const mockSupabase = {
  auth: {
    getUser: async () => ({
      data: { user: { id: 'usr_bypass_tester_456', email: 'bypass.user@example.com' } },
      error: null,
    }),
  },
  from: (table) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          gte: async () => ({ count: 0, error: null }),
        }),
        order: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    }),
    insert: (data) => {
      capturedDbRows.push({ table, data });
      return {
        select: () => ({
          single: async () => ({ data: { id: '99999999-9999-9999-9999-999999999999' }, error: null }),
        }),
      };
    },
    update: () => ({
      eq: async () => ({ error: null }),
    }),
  }),
};

const customRequire = (id) => {
  if (id === 'next/server') {
    return {
      NextResponse: {
        json: (body, init) => ({ status: init?.status || 200, body, json: async () => body }),
      },
    };
  }
  if (id === '@/lib/supabase/server') return { createClient: async () => mockSupabase };
  if (id === '@google/genai') return { GoogleGenAI: MockGoogleGenAI };
  if (id === '@/lib/chat/prepare') return { prepareMessage, extractMaxIndices };
  if (id === '@/src/lib/dlp') return { extractMaxIndices };
  return {};
};

const moduleObj = { exports: {} };
const fn = new Function('require', 'module', 'exports', 'process', transpiled);
process.env.GEMINI_MODEL = 'gemini-3.8-flash';
process.env.GEMINI_API_KEY = 'mock_key';
fn(customRequire, moduleObj, moduleObj.exports, process);

const POST = moduleObj.exports.POST;

async function runTest() {
  // Directly post an UNMASKED raw message with PII (client was completely bypassed)
  const rawAttackerPayload = `BYPASS_ATTEMPT: Aadhaar=${rawAadhaar}, PAN=${rawPan}, Phone=${rawPhone}, Card=${rawCard}, Key=${rawApiKey}`;

  console.log(`[RAW INPUT SENT DIRECTLY TO /api/chat]:`);
  console.log(`  "${rawAttackerPayload}"\n`);

  const req = {
    json: async () => ({ message: rawAttackerPayload }),
  };

  const res = await POST(req);
  assert(res.status === 200, 'POST /api/chat handler returns 200 OK');

  console.log('\n[EVIDENCE 1: Gemini Request Payload Contents]:');
  const geminiPayloadStr = JSON.stringify(capturedGeminiContents, null, 2);
  console.log(geminiPayloadStr);

  assert(!geminiPayloadStr.includes(rawAadhaar), 'Gemini payload contains NO raw Aadhaar');
  assert(!geminiPayloadStr.includes(rawPan), 'Gemini payload contains NO raw PAN');
  assert(!geminiPayloadStr.includes(rawPhone), 'Gemini payload contains NO raw Phone');
  assert(!geminiPayloadStr.includes(rawCard), 'Gemini payload contains NO raw Card');
  assert(!geminiPayloadStr.includes(rawApiKey), 'Gemini payload contains NO raw API Key');
  assert(geminiPayloadStr.includes('[AADHAAR_1]'), 'Gemini payload contains [AADHAAR_1] placeholder');
  assert(geminiPayloadStr.includes('[PAN_1]'), 'Gemini payload contains [PAN_1] placeholder');
  assert(geminiPayloadStr.includes('[PHONE_1]'), 'Gemini payload contains [PHONE_1] placeholder');

  console.log('\n[EVIDENCE 2: Database Rows Persisted]:');
  console.log(JSON.stringify(capturedDbRows, null, 2));

  const convRow = capturedDbRows.find((r) => r.table === 'conversations');
  const userMsgRow = capturedDbRows.find((r) => r.table === 'messages' && r.data.role === 'user');
  const asstMsgRow = capturedDbRows.find((r) => r.table === 'messages' && r.data.role === 'assistant');

  // Verify conversation title
  assert(!convRow.data.title.includes(rawAadhaar), 'conversations.title contains NO raw Aadhaar');
  assert(!convRow.data.title.includes(rawPan), 'conversations.title contains NO raw PAN');
  assert(!convRow.data.title.includes(rawPhone), 'conversations.title contains NO raw Phone');

  // Verify user message row
  assert(!userMsgRow.data.content.includes(rawAadhaar), 'messages.content (user) contains NO raw Aadhaar');
  assert(!userMsgRow.data.content.includes(rawPan), 'messages.content (user) contains NO raw PAN');
  assert(!userMsgRow.data.content.includes(rawPhone), 'messages.content (user) contains NO raw Phone');
  assert(userMsgRow.data.content.includes('[AADHAAR_1]'), 'messages.content (user) contains [AADHAAR_1]');
  assert(userMsgRow.data.content.includes('[PAN_1]'), 'messages.content (user) contains [PAN_1]');
  assert(userMsgRow.data.content.includes('[PHONE_1]'), 'messages.content (user) contains [PHONE_1]');

  // Verify assistant message row (sanitized before DB persistence)
  assert(!asstMsgRow.data.content.includes(rawAadhaar), 'messages.content (assistant) contains NO raw Aadhaar');
  assert(!asstMsgRow.data.content.includes(rawPan), 'messages.content (assistant) contains NO raw PAN');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('======================================================\n');

  if (failedTests > 0) process.exit(1);
}

runTest().catch((err) => {
  console.error('Bypass test failed:', err);
  process.exit(1);
});
