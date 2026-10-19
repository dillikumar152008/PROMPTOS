import { prepareMessage } from '../lib/chat/prepare.js';
import { scanPrompt, maskPrompt, restorePlaceholders } from '../src/lib/dlp.js';

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
console.log('   PROMPTOS /api/chat DLP STORAGE RULES TEST SUITE');
console.log('======================================================\n');

// Test data: Fake Aadhaar (valid Verhoeff), PAN (valid format), Mobile (+91 format)
const fakeAadhaar = '2345 6789 0124';
const fakePan = 'ABCPE1234F';
const fakeMobile = '+91 98765 43210';

const rawChatMessage = `Please verify customer records for mobile ${fakeMobile}, Aadhaar ${fakeAadhaar}, and PAN ${fakePan}.`;

console.log('[STEP 1] Testing prepareMessage() Server-Side Masking...');
const preparedMessage = prepareMessage(rawChatMessage);

// Assertion 1: Raw values must not exist in preparedMessage
assert(!preparedMessage.includes(fakeAadhaar), 'preparedMessage does NOT contain raw Aadhaar');
assert(!preparedMessage.includes(fakePan), 'preparedMessage does NOT contain raw PAN');
assert(!preparedMessage.includes(fakeMobile), 'preparedMessage does NOT contain raw Mobile number');

// Assertion 2: Placeholders must be present
assert(preparedMessage.includes('[AADHAAR_1]'), 'preparedMessage contains [AADHAAR_1] placeholder');
assert(preparedMessage.includes('[PAN_1]'), 'preparedMessage contains [PAN_1] placeholder');
assert(preparedMessage.includes('[PHONE_1]'), 'preparedMessage contains [PHONE_1] placeholder');

console.log('\n[STEP 2] Simulating /api/chat Payload Construction for Gemini...');
// In /api/chat:
// contents: history.map(...) + [{ role: 'user', parts: [{ text: prepareMessage(rawMessage) }] }]
const history = [
  { role: 'user', content: 'Initial message' },
  { role: 'assistant', content: 'Initial response' },
];

const contentsPassedToGemini = history.map((msg) => ({
  role: msg.role === 'assistant' ? 'model' : 'user',
  parts: [{ text: prepareMessage(msg.content) }],
}));

contentsPassedToGemini.push({
  role: 'user',
  parts: [{ text: prepareMessage(rawChatMessage) }],
});

const geminiPayloadString = JSON.stringify(contentsPassedToGemini);
assert(!geminiPayloadString.includes(fakeAadhaar), 'Text passed to Gemini contains NO raw Aadhaar');
assert(!geminiPayloadString.includes(fakePan), 'Text passed to Gemini contains NO raw PAN');
assert(!geminiPayloadString.includes(fakeMobile), 'Text passed to Gemini contains NO raw Mobile number');

console.log('\n[STEP 3] Simulating Database Persistence for messages.content...');
// In /api/chat:
// safeUserMessage = prepareMessage(rawMessage)
// safeAssistantMessage = prepareMessage(outputText)
const safeUserMessage = prepareMessage(rawChatMessage);

// Simulated model output that references the user input
const mockGeminiOutput = `Customer records verified: Mobile [PHONE_1], Aadhaar [AADHAAR_1], and PAN [PAN_1] are valid.`;
const safeAssistantMessage = prepareMessage(mockGeminiOutput);

// Suppose a rogue model output attempted to spit back a raw PAN or Aadhaar
const rogueModelOutput = `Leaked: ${fakeAadhaar} and ${fakePan}`;
const sanitizedAssistantMessage = prepareMessage(rogueModelOutput);

const savedDbUserContent = safeUserMessage;
const savedDbAssistantContent = safeAssistantMessage;

assert(!savedDbUserContent.includes(fakeAadhaar), 'messages.content (user) contains NO raw Aadhaar');
assert(!savedDbUserContent.includes(fakePan), 'messages.content (user) contains NO raw PAN');
assert(!savedDbUserContent.includes(fakeMobile), 'messages.content (user) contains NO raw Mobile number');

assert(!savedDbAssistantContent.includes(fakeAadhaar), 'messages.content (assistant) contains NO raw Aadhaar');
assert(!savedDbAssistantContent.includes(fakePan), 'messages.content (assistant) contains NO raw PAN');
assert(!savedDbAssistantContent.includes(fakeMobile), 'messages.content (assistant) contains NO raw Mobile number');

assert(!sanitizedAssistantMessage.includes(fakeAadhaar), 'Rogue assistant output with PII is masked before DB insert');
assert(!sanitizedAssistantMessage.includes(fakePan), 'Rogue assistant output with PAN is masked before DB insert');

console.log('\n[STEP 4] Client-Side Browser-Only Response Restoration Verification...');
// In browser: user typed raw text, client scanPrompt + maskPrompt generated placeholder map
const clientFindings = scanPrompt(rawChatMessage);
const { map: clientMemoryMap } = maskPrompt(rawChatMessage, clientFindings);

// Browser receives masked output from /api/chat and restores placeholders locally
const restoredInBrowser = restorePlaceholders(mockGeminiOutput, clientMemoryMap);
assert(restoredInBrowser.includes(fakeAadhaar), 'Browser locally restores Aadhaar for user display');
assert(restoredInBrowser.includes(fakePan), 'Browser locally restores PAN for user display');
assert(restoredInBrowser.includes(fakeMobile), 'Browser locally restores Mobile number for user display');

console.log('\n------------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
console.log('------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
}
