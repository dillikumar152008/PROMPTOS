// ==============================================================================
// SYNTHETIC TEST SUITE: ALL DATA BELOW IS 100% SYNTHETIC AND FOR TESTING ONLY.
// ZERO REAL PERSONAL DATA, PASSWORDS, OR SECRETS ARE STORED OR TESTED.
// ==============================================================================

import { scanPrompt, maskPrompt, restorePlaceholders } from '../lib/dlp.js';

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
console.log('   PROMPTOS CONCURRENT RESTORATION ISOLATION TEST');
console.log('   (Verifies all 5 DLP types across concurrent requests)');
console.log('======================================================\n');

// 1. Define distinct synthetic test values for all 5 categories
// Category 1: Aadhaar (Verhoeff valid synthetic numbers)
const AADHAAR_A = '2345 6789 0124';
const AADHAAR_B = '3456 7890 1238';

// Category 2: PAN (Valid format synthetic identifiers)
const PAN_A = 'ABCPE1234F';
const PAN_B = 'XYZPR9876K';

// Category 3: Phone (Indian mobile format synthetic numbers)
const PHONE_A = '+91 98765 43210';
const PHONE_B = '+91 91234 56789';

// Category 4: Card (Luhn valid 16-digit synthetic test cards)
const CARD_A = '4111 1111 1111 1111';
const CARD_B = '4222 2222 2222 2220';

// Category 5: API Key (Synthetic non-sensitive dummy test tokens)
const KEY_A = 'sk-' + 'SYNTHETIC-DUMMY-API-KEY-FOR-TESTING-001';
const KEY_B = 'sk-' + 'SYNTHETIC-DUMMY-API-KEY-FOR-TESTING-002';

// 2. Formulate unmasked prompts for both sessions
const promptA = `Session A details: Aadhaar ${AADHAAR_A}, PAN ${PAN_A}, Phone ${PHONE_A}, Card ${CARD_A}, Key ${KEY_A}`;
const promptB = `Session B details: Aadhaar ${AADHAAR_B}, PAN ${PAN_B}, Phone ${PHONE_B}, Card ${CARD_B}, Key ${KEY_B}`;

console.log('[PROMPT A]:', promptA);
console.log('[PROMPT B]:', promptB);

// 3. Scan & Mask on the respective clients
const findingsA = scanPrompt(promptA);
const { masked: maskedA, map: mapA } = maskPrompt(promptA, findingsA);

const findingsB = scanPrompt(promptB);
const { masked: maskedB, map: mapB } = maskPrompt(promptB, findingsB);

assert(findingsA.length === 5, 'Session A detected exactly 5 findings');
assert(findingsB.length === 5, 'Session B detected exactly 5 findings');

console.log('\n[MASKED A]:', maskedA);
console.log('[MAP A]:', JSON.stringify(mapA));
console.log('[MASKED B]:', maskedB);
console.log('[MAP B]:', JSON.stringify(mapB));

// 4. Upstream model responses containing identical placeholder identifiers
const modelReplyA = `Server processed Session A: [AADHAAR_1], [PAN_1], [PHONE_1], [CARD_1], [API_KEY_1]. Done.`;
const modelReplyB = `Server processed Session B: [AADHAAR_1], [PAN_1], [PHONE_1], [CARD_1], [API_KEY_1]. Done.`;

// 5. Execute simulated asynchronous concurrent restoration
async function restoreAsync(reply, map, delayMs) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return restorePlaceholders(reply, map);
}

async function runConcurrentTest() {
  // Fire both restorations concurrently with interleaved execution delays
  const [restoredA, restoredB] = await Promise.all([
    restoreAsync(modelReplyA, mapA, 30),
    restoreAsync(modelReplyB, mapB, 15),
  ]);

  console.log('\n[RESTORED A]:', restoredA);
  console.log('[RESTORED B]:', restoredB);

  console.log('\n--- Verifying Session A Restoration ---');
  assert(restoredA.includes(AADHAAR_A), 'Restored A contains Aadhaar A');
  assert(restoredA.includes(PAN_A), 'Restored A contains PAN A');
  assert(restoredA.includes(PHONE_A), 'Restored A contains Phone A');
  assert(restoredA.includes(CARD_A), 'Restored A contains Card A');
  assert(restoredA.includes(KEY_A), 'Restored A contains Key A');

  // Verify Session A has NO Session B data
  assert(!restoredA.includes(AADHAAR_B), 'Restored A does NOT contain Aadhaar B');
  assert(!restoredA.includes(PAN_B), 'Restored A does NOT contain PAN B');
  assert(!restoredA.includes(PHONE_B), 'Restored A does NOT contain Phone B');
  assert(!restoredA.includes(CARD_B), 'Restored A does NOT contain Card B');
  assert(!restoredA.includes(KEY_B), 'Restored A does NOT contain Key B');

  // Verify Session A has NO remaining placeholders
  assert(!restoredA.includes('[AADHAAR_1]'), 'Restored A has NO [AADHAAR_1]');
  assert(!restoredA.includes('[PAN_1]'), 'Restored A has NO [PAN_1]');
  assert(!restoredA.includes('[PHONE_1]'), 'Restored A has NO [PHONE_1]');
  assert(!restoredA.includes('[CARD_1]'), 'Restored A has NO [CARD_1]');
  assert(!restoredA.includes('[API_KEY_1]'), 'Restored A has NO [API_KEY_1]');

  console.log('\n--- Verifying Session B Restoration ---');
  assert(restoredB.includes(AADHAAR_B), 'Restored B contains Aadhaar B');
  assert(restoredB.includes(PAN_B), 'Restored B contains PAN B');
  assert(restoredB.includes(PHONE_B), 'Restored B contains Phone B');
  assert(restoredB.includes(CARD_B), 'Restored B contains Card B');
  assert(restoredB.includes(KEY_B), 'Restored B contains Key B');

  // Verify Session B has NO Session A data
  assert(!restoredB.includes(AADHAAR_A), 'Restored B does NOT contain Aadhaar A');
  assert(!restoredB.includes(PAN_A), 'Restored B does NOT contain PAN A');
  assert(!restoredB.includes(PHONE_A), 'Restored B does NOT contain Phone A');
  assert(!restoredB.includes(CARD_A), 'Restored B does NOT contain Card A');
  assert(!restoredB.includes(KEY_A), 'Restored B does NOT contain Key A');

  // Verify Session B has NO remaining placeholders
  assert(!restoredB.includes('[AADHAAR_1]'), 'Restored B has NO [AADHAAR_1]');
  assert(!restoredB.includes('[PAN_1]'), 'Restored B has NO [PAN_1]');
  assert(!restoredB.includes('[PHONE_1]'), 'Restored B has NO [PHONE_1]');
  assert(!restoredB.includes('[CARD_1]'), 'Restored B has NO [CARD_1]');
  assert(!restoredB.includes('[API_KEY_1]'), 'Restored B has NO [API_KEY_1]');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('======================================================\n');

  if (failedTests > 0) process.exit(1);
}

runConcurrentTest().catch((err) => {
  console.error('Concurrent test error:', err);
  process.exit(1);
});
