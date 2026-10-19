// ==============================================================================
// SYNTHETIC TEST SUITE: ALL DATA BELOW IS 100% SYNTHETIC AND FOR TESTING ONLY.
// ZERO REAL PERSONAL DATA, PASSWORDS, OR SECRETS ARE STORED OR TESTED.
// ==============================================================================

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prepareMessage, extractMaxIndices } from '../lib/chat/prepare.js';
import { validateImageFiles, checkAttachmentRateLimit } from '../lib/attachments/validate.js';

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
console.log('   PROMPTOS ROUTE-LEVEL MOCK TEST SUITE');
console.log('   (Real app/api/chat/route.ts with Mocked Clients)');
console.log('======================================================\n');

// 1. Transpile the real Next.js route handler to CommonJS for dynamic in-memory execution
const routePath = path.join(projectRoot, 'app/api/chat/route.ts');
const routeSource = fs.readFileSync(routePath, 'utf8');

const transpiled = ts.transpileModule(routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

// 2. Sensitive test data:
const fakeAadhaar = '2345 6789 0124'; // Verhoeff valid
const fakePan = 'ABCPE1234F';         // Valid PAN format
const fakeMobile = '+91 98765 43210'; // Valid Mobile format
const fakeCard = '4111 1111 1111 1111'; // Luhn valid
const fakeApiKey = 'sk-' + 'SYNTHETIC-DUMMY-API-KEY-FOR-TESTING-001'; // Safe synthetic key

const piiValues = [
  { name: 'Aadhaar', val: fakeAadhaar, placeholder: '[AADHAAR_1]' },
  { name: 'PAN', val: fakePan, placeholder: '[PAN_1]' },
  { name: 'Mobile', val: fakeMobile, placeholder: '[PHONE_1]' },
  { name: 'Card', val: fakeCard, placeholder: '[CARD_1]' },
  { name: 'API Key', val: fakeApiKey, placeholder: '[API_KEY_1]' },
];

// Helper to create fresh mocked clients for each test case
function createTestEnvironment(options = {}) {
  const {
    authenticated = true,
    userCountLastMin = 0,
    failCountQuery = false,
    existingConversation = null,
    geminiReply = 'I have processed your request safely.',
  } = options;

  let capturedGeminiPayload = null;
  const capturedDbInserts = [];
  const capturedDbUpdates = [];

  class MockGoogleGenAI {
    constructor(opts) {
      this.apiKey = opts.apiKey;
      this.models = {
        countTokens: async (args) => {
          if (options.simulateOverTokens) {
            return { totalTokens: 20000 };
          }
          return { totalTokens: 150 };
        },
        generateContent: async (args) => {
          if (options.simulateGemini429) {
            throw new Error('429 RESOURCE_EXHAUSTED: Quota exceeded for model');
          }
          capturedGeminiPayload = args;
          return { text: geminiReply };
        },
      };
    }
  }

  const mockSupabase = {
    auth: {
      getUser: async () => {
        if (!authenticated) {
          return { data: { user: null }, error: { message: 'Not logged in' } };
        }
        return {
          data: {
            user: { id: 'usr_mock_user_123', email: 'user@example.com' },
          },
          error: null,
        };
      },
    },
    from: (table) => {
      return {
        select: (cols, selectOpts) => {
          return {
            eq: (col1, val1) => {
              return {
                eq: (col2, val2) => {
                  return {
                    gte: async () => {
                      if (failCountQuery) {
                        return { count: null, error: { message: 'Database connection failed' } };
                      }
                      return { count: userCountLastMin, error: null };
                    },
                  };
                },
                order: (orderCol, orderOpts) => {
                  return {
                    limit: async () => ({ data: [], error: null }),
                  };
                },
                maybeSingle: async () => {
                  if (existingConversation && existingConversation.id === val1) {
                    return { data: existingConversation, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        insert: (data) => {
          capturedDbInserts.push({ table, data });
          return {
            select: () => ({
              single: async () => ({
                data: { id: '22222222-2222-2222-2222-222222222222' },
                error: null,
              }),
            }),
          };
        },
        update: (data) => {
          return {
            eq: async (col, val) => {
              capturedDbUpdates.push({ table, data, col, val });
              return { error: null };
            },
          };
        },
      };
    },
  };

  const customRequire = (id) => {
    if (id === 'next/server') {
      return {
        NextResponse: {
          json: (body, init) => ({
            status: init?.status || 200,
            body,
            json: async () => body,
          }),
        },
      };
    }
    if (id === '@/lib/supabase/server') {
      return { createClient: async () => mockSupabase };
    }
    if (id === '@google/genai') {
      return { GoogleGenAI: MockGoogleGenAI };
    }
    if (id === '@/lib/chat/prepare') {
      return { prepareMessage, extractMaxIndices };
    }
    if (id === '@/lib/attachments/config') {
      return {
        MAX_INPUT_TOKENS: 15000,
        MAX_HISTORY_MESSAGES: 10,
        MAX_OUTPUT_TOKENS_WITH_ATTACHMENT: 2048,
        MAX_IMAGE_COUNT: 2,
        MAX_TOTAL_ATTACHMENT_BYTES: 3.5 * 1024 * 1024,
      };
    }
    if (id === '@/lib/attachments/validate') {
      return {
        validateImageFiles,
        checkAttachmentRateLimit,
      };
    }
    if (id === '@/src/lib/dlp') {
      return { extractMaxIndices };
    }
    return {};
  };

  const moduleObj = { exports: {} };
  const fn = new Function('require', 'module', 'exports', 'process', transpiled);
  process.env.GEMINI_MODEL = 'gemini-1.5-flash';
  process.env.GEMINI_API_KEY = 'mock_gemini_api_key';
  fn(customRequire, moduleObj, moduleObj.exports, process);

  const POST = moduleObj.exports.POST;

  return {
    POST,
    getCapturedGemini: () => capturedGeminiPayload,
    getCapturedInserts: () => capturedDbInserts,
    getCapturedUpdates: () => capturedDbUpdates,
  };
}

async function runMockTestSuite() {
  // TEST CASE 1: Full PII Message with 5 sensitive values
  console.log('[TEST 1] Sending message containing Fake Aadhaar, PAN, Mobile, Card & API Key...');
  const test1Env = createTestEnvironment({
    geminiReply: `Echoing: Aadhaar ${fakeAadhaar}, Card ${fakeCard}, Key ${fakeApiKey}`,
  });

  const fullPiiMessage = `Check my accounts: Aadhaar is ${fakeAadhaar}, PAN is ${fakePan}, Phone is ${fakeMobile}, Card is ${fakeCard}, API key is ${fakeApiKey}.`;

  const req1 = {
    json: async () => ({ message: fullPiiMessage }),
  };

  const res1 = await test1Env.POST(req1);
  assert(res1.status === 200, 'POST route handler returns 200 OK');

  const geminiPayload = test1Env.getCapturedGemini();
  const geminiPayloadStr = JSON.stringify(geminiPayload);

  console.log('\n  --> Asserting Zero PII in Gemini Payload:');
  for (const { name, val, placeholder } of piiValues) {
    assert(!geminiPayloadStr.includes(val), `Gemini payload contains NO raw ${name}`);
    assert(geminiPayloadStr.includes(placeholder), `Gemini payload contains ${placeholder}`);
  }

  const inserts = test1Env.getCapturedInserts();
  console.log('\n  --> Asserting Zero PII in Supabase Database Inserts:');
  assert(inserts.length >= 3, `Expected at least 3 inserts (conversation + user msg + assistant msg), got ${inserts.length}`);

  const convInsert = inserts.find((i) => i.table === 'conversations');
  const userMsgInsert = inserts.find((i) => i.table === 'messages' && i.data.role === 'user');
  const asstMsgInsert = inserts.find((i) => i.table === 'messages' && i.data.role === 'assistant');

  assert(!!convInsert, 'Conversation row inserted');
  assert(!!userMsgInsert, 'User message row inserted');
  assert(!!asstMsgInsert, 'Assistant message row inserted');

  // Verify conversation title
  for (const { name, val } of piiValues) {
    assert(!convInsert.data.title.includes(val), `conversation.title contains NO raw ${name}`);
  }

  // Verify user message content
  for (const { name, val, placeholder } of piiValues) {
    assert(!userMsgInsert.data.content.includes(val), `messages.content (user) contains NO raw ${name}`);
    assert(userMsgInsert.data.content.includes(placeholder), `messages.content (user) has placeholder ${placeholder}`);
  }

  // Verify assistant message content (even when model generated PII in reply)
  for (const { name, val } of piiValues) {
    assert(!asstMsgInsert.data.content.includes(val), `messages.content (assistant) contains NO raw ${name}`);
  }

  // TEST CASE 2: Invalid UUID conversationId returns 400
  console.log('\n[TEST 2] Testing conversationId validation (invalid format)...');
  const test2Env = createTestEnvironment();
  const req2 = {
    json: async () => ({
      message: 'Hello world',
      conversationId: 'invalid-non-uuid-12345',
    }),
  };
  const res2 = await test2Env.POST(req2);
  assert(res2.status === 400, 'Invalid conversationId returns 400 Bad Request');
  assert(res2.body?.error === 'Invalid conversationId.', 'Error message specifies Invalid conversationId.');

  // TEST CASE 3: Valid UUID conversationId existing flow
  console.log('\n[TEST 3] Testing valid UUID conversationId append flow...');
  const validUuid = '12345678-1234-1234-1234-123456789abc';
  const test3Env = createTestEnvironment({
    existingConversation: { id: validUuid, title: 'Existing Conv' },
  });
  const req3 = {
    json: async () => ({
      message: `Update with PAN: ${fakePan}`,
      conversationId: validUuid,
    }),
  };
  const res3 = await test3Env.POST(req3);
  assert(res3.status === 200, 'Valid UUID conversationId returns 200');
  const test3Inserts = test3Env.getCapturedInserts();
  assert(!test3Inserts.some((i) => i.table === 'conversations'), 'Does NOT create a new conversation when conversationId exists');
  const test3UserMsg = test3Inserts.find((i) => i.table === 'messages' && i.data.role === 'user');
  assert(!test3UserMsg.data.content.includes(fakePan), 'Appended message contains NO raw PAN');
  assert(test3UserMsg.data.content.includes('[PAN_1]'), 'Appended message contains [PAN_1]');

  // TEST CASE 4: Rate limit (>= 10 messages)
  console.log('\n[TEST 4] Testing rate limit threshold (10 msgs in 60s)...');
  const test4Env = createTestEnvironment({ userCountLastMin: 10 });
  const req4 = {
    json: async () => ({ message: 'Testing rate limit' }),
  };
  const res4 = await test4Env.POST(req4);
  assert(res4.status === 429, '10 messages in 60s returns 429 Too Many Requests');

  // TEST CASE 5: Rate limit query failure fails closed (503)
  console.log('\n[TEST 5] Testing rate limit query failure (fail-closed)...');
  const test5Env = createTestEnvironment({ failCountQuery: true });
  const req5 = {
    json: async () => ({ message: 'Testing fail closed' }),
  };
  const res5 = await test5Env.POST(req5);
  assert(res5.status === 503, 'Rate limit query failure returns 503 Service Unavailable');

  // TEST CASE 6: Unauthenticated request returns 401
  console.log('\n[TEST 6] Testing unauthenticated visitor...');
  const test6Env = createTestEnvironment({ authenticated: false });
  const req6 = {
    json: async () => ({ message: 'Unauthenticated message' }),
  };
  const res6 = await test6Env.POST(req6);
  assert(res6.status === 401, 'Unauthenticated visitor returns 401 Unauthorized');

  // TEST CASE 7: Multipart upload with valid image and sensitive prompt
  console.log('\n[TEST 7] Testing multipart upload with valid image and sensitive prompt...');
  const test7Env = createTestEnvironment();
  const validPngBuf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const mockPngFile = {
    name: 'user_doc.png',
    size: validPngBuf.length,
    type: 'image/png',
    arrayBuffer: async () => validPngBuf.buffer.slice(validPngBuf.byteOffset, validPngBuf.byteOffset + validPngBuf.byteLength),
  };
  const req7 = {
    headers: { 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' },
    formData: async () => ({
      get: (key) => {
        if (key === 'message') return 'Analyze this receipt: Aadhaar is 2345 6789 0124';
        return null;
      },
      getAll: (key) => {
        if (key === 'images') return [mockPngFile];
        return [];
      },
    }),
  };
  const res7 = await test7Env.POST(req7);
  assert(res7.status === 200, 'Multipart request with image returns 200 OK');
  const geminiPayload7 = test7Env.getCapturedGemini();
  assert(!JSON.stringify(geminiPayload7).includes('2345 6789 0124'), 'Gemini payload has NO raw Aadhaar');
  assert(JSON.stringify(geminiPayload7).includes('[AADHAAR_1]'), 'Gemini payload has [AADHAAR_1] placeholder');
  assert(JSON.stringify(geminiPayload7).includes('inlineData'), 'Gemini payload contains inlineData part for image');
  assert(JSON.stringify(geminiPayload7).includes('image/png'), 'Gemini payload specifies image/png MIME');
  const inserts7 = test7Env.getCapturedInserts();
  const insertedUserMsg = inserts7.find((m) => m.data.role === 'user');
  assert(insertedUserMsg && insertedUserMsg.data.content.includes('[Attachment: user_doc.png'), 'Supabase user message has attachment metadata header');
  assert(insertedUserMsg && !insertedUserMsg.data.content.includes('2345 6789 0124'), 'Supabase user message has NO raw Aadhaar');
  assert(insertedUserMsg && !insertedUserMsg.data.content.includes('data:image'), 'Supabase user message has NO raw image/binary data');

  // TEST CASE 8: Over-token budget rejection (413)
  console.log('\n[TEST 8] Testing over-token budget rejection (413)...');
  const test8Env = createTestEnvironment({ simulateOverTokens: true });
  const req8 = {
    json: async () => ({ message: 'Testing very large token budget prompt' }),
  };
  const res8 = await test8Env.POST(req8);
  assert(res8.status === 413, 'Over-budget request returns 413 status');
  const res8Body = await res8.json();
  assert(res8Body.error.includes('too large'), 'Over-budget error message is clear and friendly');

  // TEST CASE 9: Simulated Gemini 429 quota error handled gracefully
  console.log('\n[TEST 9] Testing simulated Gemini 429 quota error...');
  const test9Env = createTestEnvironment({ simulateGemini429: true });
  const req9 = {
    json: async () => ({ message: 'Testing quota error handling' }),
  };
  const res9 = await test9Env.POST(req9);
  assert(res9.status === 429, 'Gemini quota error maps to 429 status');
  const res9Body = await res9.json();
  assert(res9Body.error.includes('The AI is busy, please try again in a minute.'), 'Friendly user-facing error returned instead of raw error');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMockTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
