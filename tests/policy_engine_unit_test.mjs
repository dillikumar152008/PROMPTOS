// ==============================================================================
// SYNTHETIC TEST SUITE: Policy Engine Unit Tests
// Covers all categories x actions, inspection statuses, and confirmReview matrix
// Zero real personal data or credentials used.
// ==============================================================================

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Transpile lib/policy.ts
const policySource = fs.readFileSync(path.join(projectRoot, 'lib/policy.ts'), 'utf8');
const transpiled = ts.transpileModule(policySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const moduleObj = { exports: {} };
const fn = new Function('require', 'module', 'exports', transpiled);
fn(() => ({}), moduleObj, moduleObj.exports);

const { evaluatePolicy, POLICY_VERSION, POLICY_CONFIG } = moduleObj.exports;

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

console.log('\n======================================================');
console.log('   PROMPTOS POLICY ENGINE UNIT TEST SUITE (PHASE 1)');
console.log('======================================================\n');

// 1. ALLOW Category: Clean content
{
  const res = evaluatePolicy([], { inspectionStatus: 'complete' });
  assert(res.action === 'allow', 'Clean input yields action "allow"');
  assert(res.inspectionStatus === 'complete', 'Clean input has inspectionStatus "complete"');
  assert(res.userOverride === false, 'userOverride is false for allow');
  assert(res.policyVersion === POLICY_VERSION, 'policyVersion is reported');
}

// 2. BLOCK Category: Payment Card (CARD)
{
  const cardFinding = { type: 'CARD', confidence: 'high', value: '4111 1111 1111 1111' };
  const res = evaluatePolicy([cardFinding], { inspectionStatus: 'complete' });
  assert(res.action === 'block', 'Payment card yields action "block"');
  assert(res.blockedCategories.includes('CARD'), 'blockedCategories includes CARD');
  assert(res.userOverride === false, 'userOverride is false on block');
}

// 3. BLOCK Category: API Key (API_KEY)
{
  const keyFinding = { type: 'API_KEY', confidence: 'high', value: 'sk-SYNTHETIC-KEY-12345' };
  const res = evaluatePolicy([keyFinding], { inspectionStatus: 'complete' });
  assert(res.action === 'block', 'API Key yields action "block"');
  assert(res.blockedCategories.includes('API_KEY'), 'blockedCategories includes API_KEY');
}

// 4. OVERRIDE MATRIX: confirmReview on BLOCK category
// Rule: confirmReview must NEVER override a block decision
{
  const cardFinding = { type: 'CARD', confidence: 'high', value: '4111 1111 1111 1111' };
  const res = evaluatePolicy([cardFinding], { inspectionStatus: 'complete', confirmReview: true });
  assert(res.action === 'block', 'confirmReview CANNOT override payment card block');
  assert(res.userOverride === false, 'userOverride remains false when block is attempted with confirmReview');
}

{
  const keyFinding = { type: 'API_KEY', confidence: 'high', value: 'sk-SYNTHETIC-KEY-12345' };
  const res = evaluatePolicy([keyFinding], { inspectionStatus: 'complete', confirmReview: true });
  assert(res.action === 'block', 'confirmReview CANNOT override API key block');
}

// 5. SANITIZE Categories: Aadhaar, PAN, Indian Mobile
{
  const aadhaarFinding = { type: 'AADHAAR', confidence: 'high', value: '2345 6789 0124' };
  const res = evaluatePolicy([aadhaarFinding], { inspectionStatus: 'complete' });
  assert(res.action === 'sanitize', 'Aadhaar yields action "sanitize"');
  assert(res.sanitizedCategories.includes('AADHAAR'), 'sanitizedCategories includes AADHAAR');
}

{
  const panFinding = { type: 'PAN', confidence: 'high', value: 'ABCPE1234F' };
  const res = evaluatePolicy([panFinding], { inspectionStatus: 'complete' });
  assert(res.action === 'sanitize', 'PAN yields action "sanitize"');
  assert(res.sanitizedCategories.includes('PAN'), 'sanitizedCategories includes PAN');
}

{
  const phoneFinding = { type: 'PHONE', confidence: 'high', value: '+91 98765 43210' };
  const res = evaluatePolicy([phoneFinding], { inspectionStatus: 'complete' });
  assert(res.action === 'sanitize', 'Indian mobile yields action "sanitize"');
  assert(res.sanitizedCategories.includes('PHONE'), 'sanitizedCategories includes PHONE');
}

// 6. REVIEW Category: Low-Confidence Finding
{
  const lowFinding = { type: 'PHONE', confidence: 'low', value: '9876543210' };
  const res = evaluatePolicy([lowFinding], { inspectionStatus: 'complete' });
  assert(res.action === 'review', 'Low-confidence finding yields action "review"');
  assert(res.userOverride === false, 'userOverride is false on unconfirmed review');
}

// 7. OVERRIDE MATRIX: confirmReview on Low-Confidence Finding
{
  const lowFinding = { type: 'PHONE', confidence: 'low', value: '9876543210' };
  const res = evaluatePolicy([lowFinding], { inspectionStatus: 'complete', confirmReview: true });
  assert(res.action === 'sanitize', 'confirmReview on low-confidence phone proceeds to "sanitize"');
  assert(res.userOverride === true, 'userOverride is true when review is confirmed');
}

// 8. REVIEW Category: Partial Document Inspection (e.g. unreadable PDF page / OCR empty)
{
  const res = evaluatePolicy([], { inspectionStatus: 'partial' });
  assert(res.action === 'review', 'inspectionStatus "partial" yields action "review"');
  assert(res.userOverride === false, 'userOverride is false on unconfirmed partial review');
}

// 9. OVERRIDE MATRIX: confirmReview on Partial Inspection
{
  const res = evaluatePolicy([], { inspectionStatus: 'partial', confirmReview: true });
  assert(res.action === 'allow', 'confirmReview on clean partial inspection proceeds to "allow"');
  assert(res.userOverride === true, 'userOverride is true for confirmed partial review');
}

// 10. OVERRIDE MATRIX: confirmReview on Partial Inspection with Aadhaar
// Rule: confirmReview must NEVER skip server-side masking for sanitize categories
{
  const aadhaarFinding = { type: 'AADHAAR', confidence: 'high', value: '2345 6789 0124' };
  const res = evaluatePolicy([aadhaarFinding], { inspectionStatus: 'partial', confirmReview: true });
  assert(res.action === 'sanitize', 'confirmReview with Aadhaar still sanitizes (masking is never skipped)');
  assert(res.userOverride === true, 'userOverride is true');
  assert(res.sanitizedCategories.includes('AADHAAR'), 'Aadhaar remains categorized as sanitized');
}

// 11. HELD Category: Failed Inspection (scanner error or timeout)
{
  const res = evaluatePolicy([], { inspectionStatus: 'failed' });
  assert(res.action === 'held', 'inspectionStatus "failed" yields action "held"');
}

// 12. OVERRIDE MATRIX: confirmReview on HELD
// Rule: confirmReview must NEVER override "held"
{
  const res = evaluatePolicy([], { inspectionStatus: 'failed', confirmReview: true });
  assert(res.action === 'held', 'confirmReview CANNOT override action "held"');
  assert(res.userOverride === false, 'userOverride is false on held');
}

// 13. HELD Category: Raw Attachment uploaded
{
  const res = evaluatePolicy([], { inspectionStatus: 'complete', hasRawAttachments: true });
  assert(res.action === 'held', 'Raw image attachments yield action "held"');
}

{
  const res = evaluatePolicy([], { inspectionStatus: 'complete', hasRawAttachments: true, confirmReview: true });
  assert(res.action === 'held', 'confirmReview CANNOT override raw attachment held action');
}

// 14. Mixed Findings: Block + Sanitize (e.g. Card + Aadhaar)
// Rule: Block takes precedence over sanitize
{
  const findings = [
    { type: 'CARD', confidence: 'high', value: '4111 1111 1111 1111' },
    { type: 'AADHAAR', confidence: 'high', value: '2345 6789 0124' },
  ];
  const res = evaluatePolicy(findings, { inspectionStatus: 'complete' });
  assert(res.action === 'block', 'Block takes precedence over sanitize in mixed findings');
}

console.log(`\nResults: ${passed}/${total} passed (${failed} failed).\n`);
if (failed > 0) process.exit(1);
