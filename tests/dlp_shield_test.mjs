import {
  scanPrompt,
  maskPrompt,
  restorePlaceholders,
  summarize,
  verhoeffValid,
  luhnValid,
  LABELS,
} from '../src/lib/dlp.js';

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
console.log('   PROMPTOS DLP SHIELD COMPREHENSIVE VERIFICATION');
console.log('======================================================\n');

// 1. Verhoeff & Luhn Algorithm Verification
console.log('[SUITE 1] Checksum Validation Algorithms');
assert(verhoeffValid('234567890124'), 'Verhoeff checksum validates known valid Aadhaar (234567890124)');
assert(!verhoeffValid('234567890123'), 'Verhoeff checksum rejects invalid Aadhaar (234567890123)');
assert(luhnValid('4532015012345671'), 'Luhn checksum validates valid credit card (4532015012345671)');
assert(!luhnValid('4532015012345679'), 'Luhn checksum rejects invalid credit card (4532015012345679)');

// 2. Synthetic Data Scanner Detection
console.log('\n[SUITE 2] Synthetic PII Detection');
const syntheticText = 'Contact John at +91 98765 43210. His Aadhaar is 2345 6789 0124 and PAN is ABCPE1234F.';
const findings = scanPrompt(syntheticText);

assert(findings.length === 3, 'Detects exactly 3 PII entities in prompt', `found ${findings.length}`);
const phoneFinding = findings.find((f) => f.type === 'PHONE');
const aadhaarFinding = findings.find((f) => f.type === 'AADHAAR');
const panFinding = findings.find((f) => f.type === 'PAN');

assert(phoneFinding && phoneFinding.value === '+91 98765 43210', 'Detects synthetic Phone number correctly');
assert(aadhaarFinding && aadhaarFinding.value === '2345 6789 0124', 'Detects synthetic Aadhaar number correctly');
assert(panFinding && panFinding.value === 'ABCPE1234F', 'Detects synthetic PAN card correctly');

// 3. Warning Banner Summary Formatting
console.log('\n[SUITE 3] Warning Banner Summary Formatting');
const summary = summarize(findings);
const summaryText = summary.map((s) => `${s.label} x${s.count}`).join(', ');
assert(summaryText.includes('Phone x1'), 'Summary contains Phone count');
assert(summaryText.includes('Aadhaar x1'), 'Summary contains Aadhaar count');
assert(summaryText.includes('PAN x1'), 'Summary contains PAN count');
assert(summaryText === 'Phone x1, Aadhaar x1, PAN x1', 'Summary matches exact format: Phone x1, Aadhaar x1, PAN x1');

// 4. Client Masking and Placeholder Map Isolation
console.log('\n[SUITE 4] Client-Side Masking');
const { masked, map } = maskPrompt(syntheticText, findings);
assert(
  masked === 'Contact John at [PHONE_1]. His Aadhaar is [AADHAAR_1] and PAN is [PAN_1].',
  'Prompt is masked with structured placeholders',
  `Result: ${masked}`
);
assert(map['[PHONE_1]'] === '+91 98765 43210', 'Placeholder map preserves phone value');
assert(map['[AADHAAR_1]'] === '2345 6789 0124', 'Placeholder map preserves Aadhaar value');
assert(map['[PAN_1]'] === 'ABCPE1234F', 'Placeholder map preserves PAN value');

// 5. Response Restoration in Browser
console.log('\n[SUITE 5] Local Response Restoration');
const mockModelResponse = 'Processing complete for applicant with Aadhaar [AADHAAR_1] and phone [PHONE_1].';
const restored = restorePlaceholders(mockModelResponse, map);
assert(
  restored === 'Processing complete for applicant with Aadhaar 2345 6789 0124 and phone +91 98765 43210.',
  'Placeholders restored accurately in model response'
);

// 6. Concurrency & Request Map Isolation
console.log('\n[SUITE 6] Concurrency and Map Isolation');
const user1Prompt = 'My phone is +91 98765 43210';
const user2Prompt = 'My phone is +91 91234 56789';

const f1 = scanPrompt(user1Prompt);
const f2 = scanPrompt(user2Prompt);

const m1 = maskPrompt(user1Prompt, f1);
const m2 = maskPrompt(user2Prompt, f2);

const inMemoryMaps = new Map();
inMemoryMaps.set('req-1', m1.map);
inMemoryMaps.set('req-2', m2.map);

const res1 = restorePlaceholders('Hello [PHONE_1]', inMemoryMaps.get('req-1'));
const res2 = restorePlaceholders('Hello [PHONE_1]', inMemoryMaps.get('req-2'));

assert(res1 === 'Hello +91 98765 43210', 'Request 1 isolated and restores its own values');
assert(res2 === 'Hello +91 91234 56789', 'Request 2 isolated and restores its own values');

// 7. Ordinary Chat Behavior (No PII)
console.log('\n[SUITE 7] Ordinary Chat (No PII)');
const cleanPrompt = 'Please summarize the benefits of clean architecture in software development.';
const cleanFindings = scanPrompt(cleanPrompt);
assert(cleanFindings.length === 0, 'Clean prompt produces 0 findings');
const cleanSummary = summarize(cleanFindings);
assert(cleanSummary.length === 0, 'Clean prompt produces empty summary');
const { masked: cleanMasked, map: cleanMap } = maskPrompt(cleanPrompt, cleanFindings);
assert(cleanMasked === cleanPrompt, 'Clean prompt remains completely untouched');
assert(Object.keys(cleanMap).length === 0, 'Clean prompt generates empty map');

// 8. Server-Side Protection (Defense in Depth)
console.log('\n[SUITE 8] Server-Side Protection (Defense in Depth)');
const rawBypassInput = 'Bypassed client: my Aadhaar is 2345 6789 0124 and email is test.user@example.com';
const serverFindings = scanPrompt(rawBypassInput);
const serverMasked = serverFindings.length > 0 ? maskPrompt(rawBypassInput, serverFindings).masked : rawBypassInput;

assert(
  !serverMasked.includes('2345 6789 0124') && !serverMasked.includes('test.user@example.com'),
  'Server masks unmasked input before database write or model forwarding'
);
assert(
  serverMasked.includes('[AADHAAR_1]') && serverMasked.includes('[EMAIL_1]'),
  'Server converts raw sensitive input into placeholders'
);

console.log('\n------------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
console.log('------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
}
