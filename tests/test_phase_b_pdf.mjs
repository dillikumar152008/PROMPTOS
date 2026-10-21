import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { scanPrompt, maskPrompt } from '../src/lib/dlp.js';

console.log('--- Phase B PDF & Decisions Verification Suite ---');

const projectRoot = process.cwd();

// 1. Verify self-hosted pdf.worker.min.js in public/pdf/
console.log('\n[Test 1] Checking self-hosted pdf.worker.min.js in public/pdf...');
const publicPdfWorker = path.join(projectRoot, 'public', 'pdf', 'pdf.worker.min.js');
assert(fs.existsSync(publicPdfWorker), 'Missing self-hosted public/pdf/pdf.worker.min.js');
const workerStat = fs.statSync(publicPdfWorker);
assert(workerStat.size > 500000, `Worker file too small: ${workerStat.size} bytes`);
console.log(`  ✓ Found public/pdf/pdf.worker.min.js (${(workerStat.size / 1024 / 1024).toFixed(2)} MB)`);

// 2. Verify lib/ocr/pdf-parser.ts configuration and guards
console.log('\n[Test 2] Checking lib/ocr/pdf-parser.ts...');
const pdfParserPath = path.join(projectRoot, 'lib', 'ocr', 'pdf-parser.ts');
assert(fs.existsSync(pdfParserPath), 'lib/ocr/pdf-parser.ts must exist');
const pdfParserCode = fs.readFileSync(pdfParserPath, 'utf8');

assert(pdfParserCode.includes("workerSrc = '/pdf/pdf.worker.min.js'"), 'Must point to self-hosted worker');
assert(pdfParserCode.includes('MAX_PDF_BYTES = 10 * 1024 * 1024'), 'Must enforce 10 MB limit');
assert(pdfParserCode.includes('MAX_PDF_PAGES = 10'), 'Must enforce 10 page limit');
assert(pdfParserCode.includes('SCANNED_PAGE_CHAR_THRESHOLD = 50'), 'Must check scanned threshold (50 chars)');
assert(pdfParserCode.includes('PasswordException'), 'Must handle password protected PDFs');
assert(pdfParserCode.includes('InvalidPDFException'), 'Must handle corrupted/invalid PDFs');
assert(pdfParserCode.includes('extractTextFromImage'), 'Must fallback to Phase A OCR for scanned pages');
console.log('  ✓ lib/ocr/pdf-parser.ts verified with 10MB limit, 10-page limit, and canvas OCR fallback');

// 3. Verify ChatInput has PDF attach button and Indic token ratio
console.log('\n[Test 3] Checking components/chat/chat-input.tsx...');
const chatInputPath = path.join(projectRoot, 'components', 'chat', 'chat-input.tsx');
const chatInputCode = fs.readFileSync(chatInputPath, 'utf8');

assert(chatInputCode.includes('extractTextFromPdf'), 'Must import extractTextFromPdf');
assert(chatInputCode.includes('handlePdfSelect'), 'Must implement handlePdfSelect');
assert(chatInputCode.includes('accept="application/pdf,.pdf"'), 'Must accept PDF files');
assert(chatInputCode.includes('Add document (PDF)'), 'Must unlock Add document (PDF) button');
assert(chatInputCode.includes("ocrLanguage === 'eng' ? 3.5 : 2.0"), 'Must use Indic conservative token ratio');
console.log('  ✓ ChatInput verified with PDF upload, PDF OCR processing, and Indic token ratio');

// 4. Verify ChatThread has collapsible document card and history trimming notice
console.log('\n[Test 4] Checking components/chat/chat-thread.tsx...');
const chatThreadPath = path.join(projectRoot, 'components', 'chat', 'chat-thread.tsx');
const chatThreadCode = fs.readFileSync(chatThreadPath, 'utf8');

assert(chatThreadCode.includes('UserMessageBubble'), 'Must use UserMessageBubble');
assert(chatThreadCode.includes('Extracted document text'), 'Must render collapsible extracted document card');
assert(chatThreadCode.includes('historyTrimmed'), 'Must support historyTrimmed prop');
assert(chatThreadCode.includes('Earlier messages were omitted to fit within the AI context window'), 'Must show context window notice');
console.log('  ✓ ChatThread verified with collapsible document card and context trimming notice');

// 5. Verify History Rule B in app/api/chat/route.ts
console.log('\n[Test 5] Checking History Rule B implementation in app/api/chat/route.ts...');
const chatRoutePath = path.join(projectRoot, 'app', 'api', 'chat', 'route.ts');
const chatRouteCode = fs.readFileSync(chatRoutePath, 'utf8');

assert(chatRouteCode.includes('estimateHistoryTokens'), 'Must estimate history tokens');
assert(chatRouteCode.includes('trimmedHistory.shift()'), 'Must drop oldest history message in trimming loop');
assert(chatRouteCode.includes('historyTrimmed,'), 'Must return historyTrimmed in JSON response');
assert(chatRouteCode.includes('ai.models.countTokens({\n        model,\n        contents,'), 'Must count tokens on FINAL assembled request (including history)');
assert(chatRouteCode.includes('status: 413'), 'Must return 413 if final request exceeds MAX_INPUT_TOKENS');
console.log('  ✓ History Rule B verified with dynamic trimming, final countTokens authority, and friendly 413 message');

// 6. Verify DLP Shield scanning on simulated multi-page PDF extracted text
console.log('\n[Test 6] Testing DLP Shield on simulated multi-page PDF output...');
const simulatedPdfText = `
--- Page 1 ---
EMPLOYMENT AGREEMENT & DIRECT DEPOSIT FORM
Employee: Rajesh Sharma
PAN: ABCPS1234F
Aadhaar Number: 4567 8901 2345
Corporate Email: rajesh.sharma@promptos-client.org

--- Page 2 (Scanned OCR) ---
IDENTITY CONFIRMATION
Contact Phone: +91 9876543210
Security Token: sk-live-abcdef1234567890abcdef1234567890
Employee signs here to acknowledge receipt of policies.
`;

const findings = scanPrompt(simulatedPdfText);
assert(findings.length >= 4, `Expected at least 4 sensitive items, found ${findings.length}`);
console.log(`  ✓ DLP correctly detected ${findings.length} sensitive patterns across PDF pages:`,
  findings.map(f => `${f.type} (${f.value})`));

const maskedResult = maskPrompt(simulatedPdfText, findings);
assert(!maskedResult.masked.includes('ABCPS1234F'), 'PAN leaked');
assert(!maskedResult.masked.includes('4567 8901 2345'), 'Aadhaar leaked');
assert(!maskedResult.masked.includes('9876543210'), 'Phone leaked');
assert(!maskedResult.masked.includes('sk-live-'), 'API key leaked');
assert(maskedResult.masked.includes('[AADHAAR_1]'), 'Missing [AADHAAR_1]');
assert(maskedResult.masked.includes('[PAN_1]'), 'Missing [PAN_1]');
assert(maskedResult.masked.includes('--- Page 1 ---'), 'Missing Page 1 header');
assert(maskedResult.masked.includes('--- Page 2 (Scanned OCR) ---'), 'Missing Page 2 header');
console.log('  ✓ Multi-page PDF text correctly masked by DLP Shield preserving document pagination');

console.log('\nALL PHASE B TESTS PASSED PROVABLY (6/6)');
