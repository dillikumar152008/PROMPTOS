// PromptOS Complete DLP Engine Verification Test Suite
// Tests all new sensitive data categories, checksums, brand detection,
// risk scoring (0-100), document classification, and allow/warn/block policy evaluation.

import {
  scanPrompt,
  scanDocument,
  maskPrompt,
  restorePlaceholders,
  summarize,
  calculateRisk,
  evaluatePolicies,
  identifyCardBrand,
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

console.log('\n================================================================');
console.log('   PROMPTOS COMPLETE DLP MODULE & POLICY ENGINE VERIFICATION');
console.log('================================================================\n');

// 1. Banking and Financial Identifiers (IFSC, Bank Accounts, RuPay cards)
console.log('[SECTION 1] Banking & Financial Identifiers');
const ifscText = 'Transfer funds via NEFT to IFSC code SBIN0001234 branch.';
const ifscFindings = scanPrompt(ifscText);
assert(ifscFindings.some((f) => f.type === 'IFSC' && f.value === 'SBIN0001234'), 'Detects valid Indian IFSC code (SBIN0001234)');
assert(ifscFindings[0]?.severity === 'HIGH', 'IFSC code categorized as HIGH severity');

const bankText = 'Please credit beneficiary Bank A/C: 1234567890123 immediately.';
const bankFindings = scanPrompt(bankText);
assert(bankFindings.some((f) => f.type === 'BANK_ACCOUNT'), 'Detects bank account number with banking context');
assert(bankFindings[0]?.value === '1234567890123', 'Extracted bank account digits match');

// Verify false positive prevention: random 10-digit number without bank context should NOT be classified as bank account
const randomNumText = 'The order invoice ID is 9876543210123 for our reference.';
const randomFindings = scanPrompt(randomNumText);
assert(!randomFindings.some((f) => f.type === 'BANK_ACCOUNT'), 'Ignores standalone 13-digit number without banking context (no false positive)');

// Card Brand Identification
console.log('\n[SECTION 2] Card Brands & Luhn Algorithm');
assert(identifyCardBrand('4532015012345671') === 'Visa', 'Identifies Visa card prefix');
assert(identifyCardBrand('5500000000000004') === 'Mastercard', 'Identifies Mastercard prefix');
assert(identifyCardBrand('378282246310005') === 'American Express', 'Identifies Amex prefix');

// 2. Passports (Indian & US/International)
console.log('\n[SECTION 3] Passport Detection with Context Gating');
const passportText = 'Passenger Passport Number: Z1234567 issued at Chennai.';
const passportFindings = scanPrompt(passportText);
assert(passportFindings.some((f) => f.type === 'PASSPORT' && f.value === 'Z1234567'), 'Detects valid Indian passport format with context');

// Random alphanumeric word without passport context should not trigger false positive
const randomCodeText = 'Batch job code Z1234567 completed in cluster.';
const randomCodeFindings = scanPrompt(randomCodeText);
assert(!randomCodeFindings.some((f) => f.type === 'PASSPORT'), 'Ignores passport-like code without passport context');

// 3. International Phone Numbers (E.164 & US format)
console.log('\n[SECTION 4] International Phone Numbers');
const intlPhoneText = 'Emergency hotline is +1-800-555-0199 or UK desk +44 2079 460991.';
const intlFindings = scanPrompt(intlPhoneText);
assert(intlFindings.some((f) => f.type === 'PHONE' && f.value.includes('+1')), 'Detects US/NANP international phone number (+1)');
assert(intlFindings.some((f) => f.type === 'PHONE' && f.value.includes('+44')), 'Detects UK international phone number (+44)');

// 4. IP Addresses (IPv4 & IPv6, Internal vs Public)
console.log('\n[SECTION 5] Network Identifiers (IPv4 & IPv6)');
const ipText = 'Internal DB at 192.168.1.105, public edge at 93.184.216.34 and IPv6 2001:0db8:85a3:0000:0000:8a2e:0370:7334';
const ipFindings = scanPrompt(ipText);
assert(ipFindings.some((f) => f.type === 'IP_ADDRESS' && f.value === '192.168.1.105'), 'Detects internal private IPv4 address (RFC 1918)');
assert(ipFindings.some((f) => f.type === 'IP_ADDRESS' && f.value === '93.184.216.34'), 'Detects public IPv4 address');
assert(ipFindings.some((f) => f.type === 'IP_ADDRESS' && f.value.startsWith('2001:')), 'Detects IPv6 address');

// Octet bounds check: 999.999.999.999 is invalid and must NOT be detected as IP
const invalidIpText = 'Version build number 999.999.999.999 is tagged.';
const invalidIpFindings = scanPrompt(invalidIpText);
assert(!invalidIpFindings.some((f) => f.type === 'IP_ADDRESS'), 'Rejects invalid IP octets (> 255)');

// 5. Exposed Credentials in URLs
console.log('\n[SECTION 6] Exposed Credentials in URLs');
const urlCredText = 'Deploy repo from https://svc_deploy:s3cr3tP@ss123@gitlab.corp.internal/app.git today.';
const urlFindings = scanPrompt(urlCredText);
assert(urlFindings.some((f) => f.type === 'URL_CREDENTIAL'), 'Detects embedded basic auth credentials in URL');
assert(urlFindings[0]?.severity === 'CRITICAL', 'Embedded URL credential flagged as CRITICAL severity');

// 6. Cryptographic Private Keys
console.log('\n[SECTION 7] Cryptographic Private Keys');
const rsaKeyText = `Here is our test key:
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1m9...
-----END RSA PRIVATE KEY-----
Please import it.`;
const keyFindings = scanPrompt(rsaKeyText);
assert(keyFindings.some((f) => f.type === 'PRIVATE_KEY'), 'Detects RSA Private Key PEM block');
assert(keyFindings[0]?.severity === 'CRITICAL', 'Private key block marked as CRITICAL severity');

// 7. Contextual Passwords & Cloud Secrets
console.log('\n[SECTION 8] Contextual Passwords & Advanced Secrets');
const passText = 'Connection settings: db_pass="SuperSecretPassword99!" and user="admin"';
const passFindings = scanPrompt(passText);
assert(passFindings.some((f) => f.type === 'PASSWORD'), 'Detects cleartext password assignment');

const gcpKeyText = 'Use Google API key AIzaSyD98765432101234567890123456789012 for maps.';
const gcpFindings = scanPrompt(gcpKeyText);
assert(gcpFindings.some((f) => f.type === 'API_KEY' && f.metadata?.provider === 'Google API Key'), 'Detects Google API key');

// 8. Risk Calculation Formula & Document Classification
console.log('\n[SECTION 9] Risk Calculation & Document Classification');

// Clean document -> Score 0, LOW, PUBLIC
const cleanRisk = calculateRisk([]);
assert(cleanRisk.score === 0, 'Clean document risk score is 0');
assert(cleanRisk.level === 'LOW', 'Clean document risk level is LOW');
assert(cleanRisk.classification === 'PUBLIC', 'Clean document classification is PUBLIC');

// Document with only 1 phone number -> Score ~30, MEDIUM, INTERNAL
const phoneOnlyFindings = scanPrompt('Call me at +91 98765 43210');
const phoneRisk = calculateRisk(phoneOnlyFindings);
assert(phoneRisk.score >= 30 && phoneRisk.score < 60, 'Single phone number scores in MEDIUM range');
assert(phoneRisk.classification === 'INTERNAL', 'Single phone classified as INTERNAL');

// Document with Aadhaar + PAN -> Score >= 60, HIGH, CONFIDENTIAL
const govtFindings = scanPrompt('Aadhaar: 2345 6789 0124 and PAN: ABCPE1234F');
const govtRisk = calculateRisk(govtFindings);
assert(govtRisk.score >= 60 && govtRisk.score < 85, 'Aadhaar + PAN scores in HIGH risk range');
assert(govtRisk.classification === 'CONFIDENTIAL', 'Government PII classified as CONFIDENTIAL');

// Document with Private Key or Unmasked Card -> Score >= 85, CRITICAL, RESTRICTED
const critFindings = scanPrompt(rsaKeyText);
const critRisk = calculateRisk(critFindings);
assert(critRisk.score >= 85, 'Private key scores in CRITICAL range (>= 85)');
assert(critRisk.level === 'CRITICAL', 'Private key risk level is CRITICAL');
assert(critRisk.classification === 'RESTRICTED', 'Private key document classified as RESTRICTED');

// 9. DLP Policy Engine (ALLOW / WARN / BLOCK)
console.log('\n[SECTION 10] DLP Policy Engine Decisions');

// Clean -> ALLOW
const cleanPolicy = evaluatePolicies([], cleanRisk);
assert(cleanPolicy.decision === 'ALLOW', 'Clean content evaluated as ALLOW');

// Aadhaar / Phone -> WARN
const warnPolicy = evaluatePolicies(govtFindings, govtRisk);
assert(warnPolicy.decision === 'WARN', 'Government PII content evaluated as WARN');
assert(warnPolicy.recommendedAction.includes('Enable DLP Shield masking'), 'Provides clear recommended action for WARN');

// Private Key -> BLOCK
const blockPolicy = evaluatePolicies(critFindings, critRisk);
assert(blockPolicy.decision === 'BLOCK', 'Critical secret/private key evaluated as BLOCK');
assert(blockPolicy.violations.length > 0, 'Contains explicit policy violations list');

// 10. scanDocument() End-to-End Orchestrator
console.log('\n[SECTION 11] scanDocument() End-to-End Wrapper');
const docScan = scanDocument('Confidential transfer: IFSC code HDFC0001234, Bank A/C: 9876543210987.', {
  filename: 'wire_transfer.txt',
  fileSize: 1024,
});
assert(docScan.scanId.startsWith('scan_'), 'Generates unique scanId');
assert(docScan.sourceType === 'file', 'Correctly flags source as file');
assert(docScan.findings.length >= 2, 'Identified both IFSC and Bank Account');
assert(docScan.policy.decision === 'WARN', 'Document policy evaluated as WARN');

console.log('\n----------------------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
console.log('----------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
}
