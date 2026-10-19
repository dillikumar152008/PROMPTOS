// ==============================================================================
// SYNTHETIC TEST SUITE: ALL DATA BELOW IS 100% SYNTHETIC AND FOR TESTING ONLY.
// ZERO REAL PERSONAL DATA, PASSWORDS, OR SECRETS ARE STORED OR TESTED.
// ==============================================================================

import { scanPrompt, maskPrompt, restorePlaceholders, summarize, luhnValid, verhoeffValid } from '../src/lib/dlp.js';

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
console.log('   PROMPTOS DLP EXTENDED UNIT TESTS');
console.log('   (Cards, API Keys, Indic Digits Normalization)');
console.log('======================================================\n');

// 1. PAYMENT CARD TESTS (Luhn valid)
console.log('[SECTION 1] Payment Card Detection & Masking (Luhn Algorithm)...');
const cardVisa = '4111 1111 1111 1111';
const cardVisa2 = '4532 0150 1234 5671';
assert(luhnValid(cardVisa.replace(/\s/g, '')), 'Luhn validator approves 4111 1111 1111 1111');
assert(luhnValid(cardVisa2.replace(/\s/g, '')), 'Luhn validator approves 4532 0150 1234 5671');

const cardPrompt = `Card details: ${cardVisa} and backup ${cardVisa2}.`;
const cardFindings = scanPrompt(cardPrompt);
assert(cardFindings.length === 2, 'scanPrompt detects both card numbers');
assert(cardFindings.every((f) => f.type === 'CARD'), 'Both findings categorized as CARD');

const { masked: cardMasked, map: cardMap } = maskPrompt(cardPrompt, cardFindings);
assert(!cardMasked.includes(cardVisa), 'Masked card text does not include cardVisa');
assert(!cardMasked.includes(cardVisa2), 'Masked card text does not include cardVisa2');
assert(cardMasked.includes('[CARD_1]') && cardMasked.includes('[CARD_2]'), 'Masked card text contains [CARD_1] and [CARD_2]');

const cardRestored = restorePlaceholders(cardMasked, cardMap);
assert(cardRestored === cardPrompt, 'Restored card text matches original prompt exactly');

// 2. API KEY TESTS (OpenAI, AWS, GitHub)
// Keys are constructed at runtime so no literal token-shaped string appears in source.
console.log('\n[SECTION 2] API Key Detection, Masking & Restoration...');
const openAiKey = 'sk-' + 'SYNTHETIC-DUMMY-API-KEY-FOR-TESTING-001';
const awsKey = 'AKIA' + 'IOSFODNN7EXAMPLE'; // AWS official documentation dummy example key
const githubKey = 'ghp_' + 'x'.repeat(36); // GitHub PAT format: ghp_ + 36 chars

const keyPrompt = `Keys to protect: ${openAiKey}, AWS ${awsKey}, GitHub ${githubKey}`;
const keyFindings = scanPrompt(keyPrompt);
assert(keyFindings.length === 3, 'scanPrompt detects all 3 API keys');
assert(keyFindings.every((f) => f.type === 'API_KEY'), 'All 3 findings categorized as API_KEY');

const { masked: keyMasked, map: keyMap } = maskPrompt(keyPrompt, keyFindings);
assert(!keyMasked.includes(openAiKey), 'Masked text does not include OpenAI key');
assert(!keyMasked.includes(awsKey), 'Masked text does not include AWS key');
assert(!keyMasked.includes(githubKey), 'Masked text does not include GitHub key');
assert(keyMasked.includes('[API_KEY_1]') && keyMasked.includes('[API_KEY_2]') && keyMasked.includes('[API_KEY_3]'), 'Masked text contains all 3 API_KEY placeholders');

const keyRestored = restorePlaceholders(keyMasked, keyMap);
assert(keyRestored === keyPrompt, 'Restored key text matches original prompt exactly');

// 3. INDIC DIGIT NORMALIZATION TESTS (Tamil & Hindi / Devanagari)
console.log('\n[SECTION 3] Indic Digit Normalization (Tamil & Devanagari)...');

// Devanagari digits: ०=0, १=1, २=2, ३=3, ४=4, ५=5, ६=6, ७=7, ८=8, ९=9
// Phone: +91 ९८७६५ ४३२१० (+91 98765 43210)
const devanagariPhone = '+91 ९८७६५ ४३२१०';
const devanagariPhonePrompt = `कृपया संपर्क करें: ${devanagariPhone}`;
const devanagariPhoneFindings = scanPrompt(devanagariPhonePrompt);
assert(devanagariPhoneFindings.length === 1, 'Devanagari phone detected');
assert(devanagariPhoneFindings[0]?.type === 'PHONE', 'Devanagari phone categorized as PHONE');
assert(devanagariPhoneFindings[0]?.value === devanagariPhone, 'Extracted raw value preserves Devanagari script');

const { masked: devPhoneMasked, map: devPhoneMap } = maskPrompt(devanagariPhonePrompt, devanagariPhoneFindings);
assert(!devPhoneMasked.includes(devanagariPhone), 'Masked text hides Devanagari phone number');
assert(devPhoneMasked.includes('[PHONE_1]'), 'Masked text contains [PHONE_1]');
const devPhoneRestored = restorePlaceholders(devPhoneMasked, devPhoneMap);
assert(devPhoneRestored === devanagariPhonePrompt, 'Restored Devanagari phone matches original prompt');

// Tamil digits: ௦=0, ௧=1, ௨=2, ௩=3, ௪=4, ௫=5, ௬=6, ௭=7, ௮=8, ௯=9
// Phone: +91 ௯௮௭௬௫ ௪௩௨௧௦ (+91 98765 43210)
const tamilPhone = '+91 ௯௮௭௬௫ ௪௩௨௧௦';
const tamilPhonePrompt = `தொடர்பு கொள்ளவும்: ${tamilPhone}`;
const tamilPhoneFindings = scanPrompt(tamilPhonePrompt);
assert(tamilPhoneFindings.length === 1, 'Tamil phone detected');
assert(tamilPhoneFindings[0]?.type === 'PHONE', 'Tamil phone categorized as PHONE');
assert(tamilPhoneFindings[0]?.value === tamilPhone, 'Extracted raw value preserves Tamil script');

const { masked: tamilPhoneMasked, map: tamilPhoneMap } = maskPrompt(tamilPhonePrompt, tamilPhoneFindings);
assert(!tamilPhoneMasked.includes(tamilPhone), 'Masked text hides Tamil phone number');
assert(tamilPhoneMasked.includes('[PHONE_1]'), 'Masked text contains [PHONE_1]');
const tamilPhoneRestored = restorePlaceholders(tamilPhoneMasked, tamilPhoneMap);
assert(tamilPhoneRestored === tamilPhonePrompt, 'Restored Tamil phone matches original prompt');

// Devanagari Aadhaar: २३४५ ६७८९ ०१२४ (2345 6789 0124) -> Verhoeff valid
const devanagariAadhaar = '२३४५ ६७८९ ०१२४';
const devAadhaarPrompt = `आधार नंबर: ${devanagariAadhaar}`;
const devAadhaarFindings = scanPrompt(devAadhaarPrompt);
assert(devAadhaarFindings.length === 1, 'Devanagari Aadhaar detected');
assert(devAadhaarFindings[0]?.type === 'AADHAAR', 'Devanagari Aadhaar categorized as AADHAAR');
assert(devAadhaarFindings[0]?.confidence === 'high', 'Devanagari Aadhaar has high confidence via Verhoeff');

// Tamil Aadhaar: ௨௩௪௫ ௬௭௮௯ ௦௧௨௪ (2345 6789 0124) -> Verhoeff valid
const tamilAadhaar = '௨௩௪௫ ௬௭௮௯ ௦௧௨௪';
const tamilAadhaarPrompt = `ஆதார் எண்: ${tamilAadhaar}`;
const tamilAadhaarFindings = scanPrompt(tamilAadhaarPrompt);
assert(tamilAadhaarFindings.length === 1, 'Tamil Aadhaar detected');
assert(tamilAadhaarFindings[0]?.type === 'AADHAAR', 'Tamil Aadhaar categorized as AADHAAR');
assert(tamilAadhaarFindings[0]?.confidence === 'high', 'Tamil Aadhaar has high confidence via Verhoeff');

// 4. SUMMARY FUNCTIONALITY
console.log('\n[SECTION 4] summarize() output verification...');
const combinedPrompt = `${cardVisa} ${openAiKey} ${devanagariPhone}`;
const summary = summarize(scanPrompt(combinedPrompt));
assert(summary.length === 3, 'summarize returns 3 distinct categories');
const summaryTypes = summary.map((s) => s.type);
assert(summaryTypes.includes('CARD') && summaryTypes.includes('API_KEY') && summaryTypes.includes('PHONE'), 'Summary includes CARD, API_KEY, and PHONE');

console.log('\n======================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
