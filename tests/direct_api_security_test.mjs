// ==============================================================================
// SYNTHETIC TEST SUITE: Direct API Security & Data Protection Pipeline Tests
// Tests /api/chat directly (no client, curl-style raw requests)
// Strictly asserts that:
// 1. Blocked / held / unconfirmed review return correct status codes (403, 422).
// 2. Gemini is NOT called in any non-proceed scenario (asserted via spy).
// 3. Quota reservation is NOT consumed in any non-proceed scenario.
// 4. confirmReview cannot override block.
// 5. Raw image multipart uploads return action: "held".
// 6. Injected scanner failure returns action: "held".
// ==============================================================================

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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

console.log('\n===================================================================');
console.log('   PROMPTOS DIRECT API SECURITY & POLICY ENFORCEMENT TEST (PHASE 1+2)');
console.log('===================================================================\n');

// Mock spies to assert Gemini execution and Quota consumption
let geminiCallCount = 0;
let lastGeminiPayload = null;
let globalQuotaCheckCount = 0;
let userRateLimitCheckCount = 0;

class MockGoogleGenAI {
  constructor(opts) {
    this.apiKey = opts.apiKey;
    this.models = {
      countTokens: async () => ({ totalTokens: 100 }),
      generateContent: async ({ contents }) => {
        geminiCallCount++;
        lastGeminiPayload = contents;
        return { text: 'Assistant response to: processed prompt' };
      },
    };
  }
}

const mockSupabase = {
  auth: {
    getUser: async () => ({
      data: { user: { id: 'usr_test_security_agent_001', email: 'sec.agent@promptos.test' } },
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
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: 'conv-test-uuid-1111' }, error: null }),
      }),
    }),
    update: () => ({
      eq: async () => ({ error: null }),
    }),
  }),
};

// 1. Transpile lib/policy.ts
const policySource = fs.readFileSync(path.join(projectRoot, 'lib/policy.ts'), 'utf8');
const transpiledPolicy = ts.transpileModule(policySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policyModule = { exports: {} };
new Function('require', 'module', 'exports', transpiledPolicy)(() => ({}), policyModule, policyModule.exports);
const { evaluatePolicy, POLICY_VERSION } = policyModule.exports;

// 2. Transpile lib/pipeline/index.ts
const dlp = await import('../src/lib/dlp.js');
const pipelineSource = fs.readFileSync(path.join(projectRoot, 'lib/pipeline/index.ts'), 'utf8');
const transpiledPipeline = ts.transpileModule(pipelineSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

let forceScannerFailure = false;

const pipelineModule = { exports: {} };
const pipelineFn = new Function('require', 'module', 'exports', transpiledPipeline);
pipelineFn(
  (id) => {
    if (id === '@/src/lib/dlp') {
      return {
        scanPrompt: (text) => {
          if (forceScannerFailure) {
            throw new Error('Injected catastrophic scanner failure');
          }
          return dlp.scanPrompt(text);
        },
        maskPrompt: dlp.maskPrompt,
      };
    }
    if (id === '@/lib/policy') return policyModule.exports;
    return {};
  },
  pipelineModule,
  pipelineModule.exports
);

const { runSecurityPipeline, ALLOW_RAW_IMAGES } = pipelineModule.exports;
const { prepareMessage, extractMaxIndices } = await import('../lib/chat/prepare.js');

// 3. Transpile app/api/chat/route.ts
const routeSource = fs.readFileSync(path.join(projectRoot, 'app/api/chat/route.ts'), 'utf8');
const transpiledRoute = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

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
      checkGlobalDailyQuota: async () => {
        globalQuotaCheckCount++;
        return { allowed: true, remaining: 20, retryAfter: 86400, usedFallback: false };
      },
      checkUserRateLimit: async () => {
        userRateLimitCheckCount++;
        return { allowed: true, retryAfter: 0 };
      },
    };
  }
  if (id === '@/lib/pipeline') {
    return {
      runSecurityPipeline,
      ALLOW_RAW_IMAGES,
    };
  }
  if (id === '@/lib/policy') return policyModule.exports;
  if (id === '@/lib/receipts') {
    return {
      createPrivacyReceipt: async (data) => ({
        success: true,
        receiptStatus: 'recorded',
        receipt: {
          id: 'rcpt_mock_001',
          createdAt: new Date().toISOString(),
          ...data,
        },
        canProceed: true,
      }),
    };
  }
  return {};
};

const routeModule = { exports: {} };
const fn = new Function('require', 'module', 'exports', 'process', transpiledRoute);
process.env.GEMINI_MODEL = 'gemini-3.8-flash';
process.env.GEMINI_API_KEY = 'test_key';
fn(customRequire, routeModule, routeModule.exports, process);

const POST = routeModule.exports.POST;

function resetSpies() {
  geminiCallCount = 0;
  lastGeminiPayload = null;
  globalQuotaCheckCount = 0;
  userRateLimitCheckCount = 0;
  forceScannerFailure = false;
}

// Helpers to simulate HTTP request
function makeJsonRequest(bodyObj) {
  return {
    headers: {
      get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => bodyObj,
  };
}

function makeMultipartRequest(message, files = []) {
  return {
    headers: {
      get: (h) => (h.toLowerCase() === 'content-type' ? 'multipart/form-data; boundary=---' : null),
    },
    formData: async () => ({
      get: (k) => (k === 'message' ? message : null),
      getAll: (k) => (k === 'images' ? files : []),
    }),
  };
}

async function runTests() {
  // Test 1: Direct API with Payment Card -> 403 Block, Gemini NOT called, Quota NOT checked
  {
    resetSpies();
    const req = makeJsonRequest({ message: 'Pay using card 4111 1111 1111 1111 now' });
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 403, 'Card direct API returns HTTP 403');
    assert(body.action === 'block', 'Card response contains action: "block"');
    assert(geminiCallCount === 0, 'Gemini is NOT called on card block');
    assert(globalQuotaCheckCount === 0, 'Quota is NOT consumed on card block');
  }

  // Test 2: Direct API with API Key -> 403 Block, Gemini NOT called
  {
    resetSpies();
    const req = makeJsonRequest({ message: 'Here is my secret sk-SYNTHETIC-KEY-999888777666' });
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 403, 'API Key direct API returns HTTP 403');
    assert(body.action === 'block', 'API Key response contains action: "block"');
    assert(geminiCallCount === 0, 'Gemini is NOT called on API key block');
    assert(globalQuotaCheckCount === 0, 'Quota is NOT consumed on API key block');
  }

  // Test 3: Direct API with confirmReview on a Card -> Still 403, Gemini NOT called
  // Rule: confirmReview must NEVER override a block
  {
    resetSpies();
    const req = makeJsonRequest({
      message: 'Pay using card 4111 1111 1111 1111 now',
      confirmReview: true,
    });
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 403, 'confirmReview on Card still returns HTTP 403');
    assert(body.action === 'block', 'confirmReview cannot change action from block');
    assert(geminiCallCount === 0, 'Gemini is NOT called when user attempts confirmReview on block');
    assert(globalQuotaCheckCount === 0, 'Quota is NOT consumed when block with confirmReview rejected');
  }

  // Test 4: Direct API with Aadhaar -> 200 Sanitized, Gemini called with MASKED placeholder only
  {
    resetSpies();
    const rawAadhaar = '2345 6789 0124';
    const req = makeJsonRequest({ message: `Customer Aadhaar number is ${rawAadhaar}. Please verify.` });
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 200, 'Aadhaar direct API returns HTTP 200');
    assert(body.action === 'sanitize', 'Aadhaar response contains action: "sanitize"');
    assert(geminiCallCount === 1, 'Gemini IS called for sanitized request');
    assert(globalQuotaCheckCount === 1, 'Quota IS reserved for authorized request');

    // Inspect Gemini payload to verify strict masking
    const sentText = lastGeminiPayload[0]?.parts[0]?.text || '';
    assert(!sentText.includes(rawAadhaar), 'Gemini payload contains NO raw Aadhaar number');
    assert(sentText.includes('[AADHAAR_1]'), 'Gemini payload contains [AADHAAR_1] masked placeholder');
  }

  // Test 5: Direct API with Partial Inspection (unreadable PDF page) -> 422 Review
  {
    resetSpies();
    const req = makeJsonRequest({
      message: 'Summarize document: --- Page 1 ---\n[No readable text detected on this page]\n--- Page 2 ---\nMeeting notes.',
      inspectionStatus: 'partial',
    });
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 422, 'Partial inspection returns HTTP 422 Review Required');
    assert(body.action === 'review', 'Response action is "review"');
    assert(geminiCallCount === 0, 'Gemini is NOT called on unconfirmed review');
    assert(globalQuotaCheckCount === 0, 'Quota is NOT consumed on unconfirmed review');
  }

  // Test 6: Direct API with confirmReview on Partial Inspection -> 200 Proceeds
  {
    resetSpies();
    const req = makeJsonRequest({
      message: 'Summarize document: --- Page 1 ---\n[No readable text detected on this page]\n--- Page 2 ---\nMeeting notes.',
      inspectionStatus: 'partial',
      confirmReview: true,
    });
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 200, 'confirmReview on partial inspection returns HTTP 200');
    assert(body.action === 'allow', 'Response action proceeds to "allow"');
    assert(body.userOverride === true, 'userOverride is true');
    assert(geminiCallCount === 1, 'Gemini IS called when review is confirmed');
    assert(globalQuotaCheckCount === 1, 'Quota IS consumed when review is confirmed');
  }

  // Test 7: Multipart with raw image attachment -> 422 Held, Gemini NOT called
  // Rule: Raw image binaries are not forwarded to Gemini.
  {
    resetSpies();
    const dummyFile = { name: 'id_card.png', size: 1024, type: 'image/png' };
    const req = makeMultipartRequest('Read this image', [dummyFile]);
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 422, 'Raw multipart image upload returns HTTP 422');
    assert(body.action === 'held', 'Raw image response contains action: "held"');
    assert(geminiCallCount === 0, 'Gemini is NOT called for raw image uploads');
    assert(globalQuotaCheckCount === 0, 'Quota is NOT consumed for raw image uploads');
  }

  // Test 8: Injected Scanner Failure -> 422 Held (Fail-Closed)
  // Rule: If scanner throws or fails, request must NOT reach Gemini.
  {
    resetSpies();
    forceScannerFailure = true;
    const req = makeJsonRequest({ message: 'Any arbitrary prompt while scanner is failing' });
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 422, 'Scanner failure returns HTTP 422 Held');
    assert(body.action === 'held', 'Response action is "held"');
    assert(body.inspectionStatus === 'failed', 'inspectionStatus is "failed"');
    assert(geminiCallCount === 0, 'Gemini is NOT called when scanner fails');
    assert(globalQuotaCheckCount === 0, 'Quota is NOT consumed when scanner fails');
  }

  // Test 9: Clean prompt with complete inspection -> 200 Allow
  {
    resetSpies();
    const req = makeJsonRequest({ message: 'Write a haiku about cybersecurity and privacy.' });
    const res = await POST(req);
    const body = await res.json();

    assert(res.status === 200, 'Clean prompt returns HTTP 200');
    assert(body.action === 'allow', 'Clean prompt response contains action: "allow"');
    assert(geminiCallCount === 1, 'Gemini IS called for clean prompt');
    assert(globalQuotaCheckCount === 1, 'Quota IS consumed for clean prompt');
  }

  console.log(`\nResults: ${passed}/${total} passed (${failed} failed).\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
