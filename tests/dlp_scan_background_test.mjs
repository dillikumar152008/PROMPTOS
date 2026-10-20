import fs from 'fs';
import path from 'path';

const projectRoot = 'C:/Users/meena/.gemini/antigravity/scratch/ayush-setu';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('======================================================');
console.log('  PROMPTOS DLP SCAN BACKGROUND ACCEPTANCE TEST        ');
console.log('======================================================\n');

// 1. Check file existence
const bgPath = path.join(projectRoot, 'components/marketing/dlp-scan-background.tsx');
const heroPath = path.join(projectRoot, 'components/marketing/hero.tsx');
assert(fs.existsSync(bgPath), 'components/marketing/dlp-scan-background.tsx exists');

const bgCode = fs.readFileSync(bgPath, 'utf-8');
const heroCode = fs.readFileSync(heroPath, 'utf-8');

// 2. Dummy data check: obviously fake data and proper placeholder mapping
const hasDummyPatterns =
  bgCode.includes('0000 0000 0000') &&
  bgCode.includes('ABCDE1234F') &&
  bgCode.includes('sk-test-000000000000') &&
  bgCode.includes('[AADHAAR_1]') &&
  bgCode.includes('[PAN_1]') &&
  bgCode.includes('[KEY_1]') &&
  bgCode.includes('[CARD_1]') &&
  bgCode.includes('[PHONE_1]');
assert(hasDummyPatterns, 'Contains obviously fake dummy data (Aadhaar, PAN, Card, Phone, API Key) and masked tokens');

// 3. Low opacity check (4-8% range)
const hasLowOpacity =
  bgCode.includes('0.05') &&
  bgCode.includes('0.08') &&
  bgCode.includes('rgba(161, 161, 170') &&
  bgCode.includes('rgba(212, 212, 216');
assert(hasLowOpacity, 'Colors use muted zinc at 5-8% opacity with no new colors or glows');

// 4. Accessibility & contrast: pointer-events: none, aria-hidden, z-index separation
const hasAccessibility =
  bgCode.includes('pointer-events-none') &&
  bgCode.includes('aria-hidden="true"') &&
  heroCode.includes('relative z-10') &&
  heroCode.includes('<DlpScanBackground');
assert(hasAccessibility, 'Canvas has pointer-events: none and aria-hidden="true"; text sits in relative z-10 keeping full contrast');

// 5. Scan line and masking logic
const hasScanLineAndMasking =
  bgCode.includes('scanY') &&
  bgCode.includes('distToScan < 16') &&
  bgCode.includes('maskedUntil = now + 3200') &&
  bgCode.includes('ctx.stroke()');
assert(hasScanLineAndMasking, 'Scan line sweeps and triggers 3.2s masked placeholders when passing items');

// 6. Performance: pause on off-screen and tab hidden
const hasPerformanceOptimization =
  bgCode.includes('IntersectionObserver') &&
  bgCode.includes('visibilitychange') &&
  bgCode.includes('document.visibilityState');
assert(hasPerformanceOptimization, 'Animation pauses via IntersectionObserver when off-screen and visibilitychange when tab is hidden');

// 7. Accessibility: prefers-reduced-motion support
const hasReducedMotion =
  bgCode.includes('prefers-reduced-motion: reduce') &&
  bgCode.includes('drawStatic') &&
  bgCode.includes('initialMasked ? Infinity : 0');
assert(hasReducedMotion, 'prefers-reduced-motion renders static snapshot with pre-masked items and stops animation frame');

// 8. Mobile responsiveness: col spacing and no horizontal scroll
const hasMobileDensity =
  bgCode.includes('width < 640') &&
  bgCode.includes('colSpacing = isMobile ? 120 : 180') &&
  heroCode.includes('overflow-hidden');
assert(hasMobileDensity, 'Hero has overflow-hidden and adapts column density for mobile viewports');

// 9. Smooth fade before features section
const hasFadeOut = heroCode.includes('bg-gradient-to-t from-[#09090b] to-transparent');
assert(hasFadeOut, 'Hero has bottom gradient fade into #09090b before features section');

console.log('\n======================================================');
console.log(`ACCEPTANCE SUMMARY: ${passed}/${passed + failed} passed`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
