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
const rawApiKey = 'sk-SYNTHETIC-DUMMY-API-KEY-FOR-TESTING-001';

let capturedGeminiContents = null;
const capturedDbRows = [];

class MockGoogleGenAI {
  constructor(opts) {
    this.apiKey = opts.apiKey;
    this.models = {
      countTokens: async () => ({ totalTokens: 42 }),
      generateContent: async ({ contents }) => {
        capturedGeminiContents = contents;
        return {
          text: `Processed: Aadhaar is ${rawAadhaar}, but model echoes safely.`,
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

// Transpile policy & pipeline
const policySource = fs.readFileSync(path.join(projectRoot, 'lib/policy.ts'), 'utf8');
const transpiledPolicy = ts.transpileModule(policySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policyModule = { exports: {} };
new Function('require', 'module', 'exports', transpiledPolicy)(() => ({}), policyModule, policyModule.exports);

const dlp = await import('../src/lib/dlp.js');
const pipelineSource = fs.readFileSync(path.join(projectRoot, 'lib/pipeline/index.ts'), 'utf8');
const transpiledPipeline = ts.transpileModule(pipelineSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const pipelineModule = { exports: {} };
new Function('require', 'module', 'exports', transpiledPipeline)(
  (id) => {
    if (id === '@/src/lib/dlp') return dlp;
    if (id === '@/lib/policy') return policyModule.exports;
    return {};
  },
  pipelineModule,
  pipelineModule.exports
);

const customRequire = (id) => {
  if (id === 'next/server') {
    return {
      NextResponse: {
        json: (body, init) => ({
          status: init?.status || 200,
          headers: new Map(Object.entries(init?.headers || {})),
          body,
          json: async () => body,
        }),
      },
    };
  }
  if (id === '@/lib/supabase/server') return { createClient: async () => mockSupabase };
  if (id === '@google/genai') return { GoogleGenAI: MockGoogleGenAI };
  if (id === '@/lib/chat/prepare') return { prepareMessage };
  if (id === '@/src/lib/dlp') return { extractMaxIndices };
  if (id === '@/lib/attachments/config') {
    return {
      MAX_INPUT_TOKENS: 100000,
      MAX_HISTORY_MESSAGES: 10,
      MAX_OUTPUT_TOKENS_WITH_ATTACHMENT: 4000,
    };
  }
  if (id === '@/lib/attachments/validate') {
    return {
      validateImageFiles: async () => ({ valid: true, images: [] }),
    };
  }
  if (id === '@/lib/ratelimit/upstash') {
    return {
      checkGlobalDailyQuota: async () => ({ allowed: true, remaining: 20, retryAfter: 86400 }),
      checkUserRateLimit: async () => ({ allowed: true, retryAfter: 0 }),
    };
  }
  if (id === '@/lib/pipeline') {
    return pipelineModule.exports;
  }
  if (id === '@/lib/policy') return policyModule.exports;
  return {};
};

const moduleObj = { exports: {} };
const fn = new Function('require', 'module', 'exports', 'process', transpiled);
process.env.GEMINI_MODEL = 'gemini-3.8-flash';
process.env.GEMINI_API_KEY = 'mock_key';
fn(customRequire, moduleObj, moduleObj.exports, process);

const POST = moduleObj.exports.POST;

async function runTest() {
  // Test 1: Direct bypass with Sanitize PII (Aadhaar, PAN, Phone)
  const rawAttackerPayload = `BYPASS_ATTEMPT: Aadhaar=${rawAadhaar}, PAN=${rawPan}, Phone=${rawPhone}`;

  console.log(`[PART 1: Direct API with Sanitize PII]:`);
  console.log(`  "${rawAttackerPayload}"\n`);

  const req = {
    headers: { get: () => 'application/json' },
    json: async () => ({ message: rawAttackerPayload }),
  };

  const res = await POST(req);
  assert(res.status === 200, 'POST /api/chat handler returns 200 OK for sanitize categories');

  console.log('\n[EVIDENCE 1: Gemini Request Payload Contents]:');
  const geminiPayloadStr = JSON.stringify(capturedGeminiContents, null, 2);
  console.log(geminiPayloadStr);

  assert(!geminiPayloadStr.includes(rawAadhaar), 'Gemini payload contains NO raw Aadhaar');
  assert(!geminiPayloadStr.includes(rawPan), 'Gemini payload contains NO raw PAN');
  assert(!geminiPayloadStr.includes(rawPhone), 'Gemini payload contains NO raw Phone');
  assert(geminiPayloadStr.includes('[AADHAAR_1]'), 'Gemini payload contains [AADHAAR_1] placeholder');
  assert(geminiPayloadStr.includes('[PAN_1]'), 'Gemini payload contains [PAN_1] placeholder');
  assert(geminiPayloadStr.includes('[PHONE_1]'), 'Gemini payload contains [PHONE_1] placeholder');

  console.log('\n[EVIDENCE 2: Database Rows Persisted]:');
  console.log(JSON.stringify(capturedDbRows, null, 2));

  const convRow = capturedDbRows.find((r) => r.table === 'conversations');
  const userMsgRow = capturedDbRows.find((r) => r.table === 'messages' && r.data.role === 'user');
  const asstMsgRow = capturedDbRows.find((r) => r.table === 'messages' && r.data.role === 'assistant');

  assert(!convRow.data.title.includes(rawAadhaar), 'conversations.title contains NO raw Aadhaar');
  assert(!convRow.data.title.includes(rawPan), 'conversations.title contains NO raw PAN');
  assert(!convRow.data.title.includes(rawPhone), 'conversations.title contains NO raw Phone');

  assert(!userMsgRow.data.content.includes(rawAadhaar), 'messages.content (user) contains NO raw Aadhaar');
  assert(!userMsgRow.data.content.includes(rawPan), 'messages.content (user) contains NO raw PAN');
  assert(!userMsgRow.data.content.includes(rawPhone), 'messages.content (user) contains NO raw Phone');
  assert(userMsgRow.data.content.includes('[AADHAAR_1]'), 'messages.content (user) contains [AADHAAR_1]');
  assert(userMsgRow.data.content.includes('[PAN_1]'), 'messages.content (user) contains [PAN_1]');
  assert(userMsgRow.data.content.includes('[PHONE_1]'), 'messages.content (user) contains [PHONE_1]');

  assert(!asstMsgRow.data.content.includes(rawAadhaar), 'messages.content (assistant) contains NO raw Aadhaar');

  // Test 2: Direct bypass with Blocked Categories (Card, API key) -> Must return 403 Blocked
  console.log('\n[PART 2: Direct API with Block Categories (Card / API Key)]:');
  const blockReq = {
    headers: { get: () => 'application/json' },
    json: async () => ({ message: `Pay using card ${rawCard} and secret ${rawApiKey}` }),
  };
  const blockRes = await POST(blockReq);
  const blockBody = await blockRes.json();

  assert(blockRes.status === 403, 'POST /api/chat returns HTTP 403 on block categories');
  assert(blockBody.action === 'block', 'Response contains action: "block"');
  assert(blockBody.categoryCounts.CARD >= 1, 'categoryCounts reports CARD');
  assert(blockBody.categoryCounts.API_KEY >= 1, 'categoryCounts reports API_KEY');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('======================================================\n');

  if (failedTests > 0) process.exit(1);
}

runTest().catch((err) => {
  console.error('Bypass test failed:', err);
  process.exit(1);
});
