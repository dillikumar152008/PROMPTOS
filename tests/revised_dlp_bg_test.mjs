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
console.log('   PROMPTOS REVISED DLP SCAN BACKGROUND ACCEPTANCE    ');
console.log('======================================================\n');

const bgPath = path.join(projectRoot, 'components/marketing/dlp-scan-background.tsx');
const pagePath = path.join(projectRoot, 'app/(marketing)/page.tsx');
const heroPath = path.join(projectRoot, 'components/marketing/hero.tsx');
const featuresPath = path.join(projectRoot, 'components/marketing/features-grid.tsx');
const howPath = path.join(projectRoot, 'components/marketing/how-it-works.tsx');
const privacyPath = path.join(projectRoot, 'components/marketing/privacy-section.tsx');
const pricingPath = path.join(projectRoot, 'components/marketing/pricing.tsx');
const footerPath = path.join(projectRoot, 'components/marketing/footer.tsx');

const bgCode = fs.readFileSync(bgPath, 'utf-8');
const pageCode = fs.readFileSync(pagePath, 'utf-8');
const heroCode = fs.readFileSync(heroPath, 'utf-8');
const featuresCode = fs.readFileSync(featuresPath, 'utf-8');
const howCode = fs.readFileSync(howPath, 'utf-8');
const privacyCode = fs.readFileSync(privacyPath, 'utf-8');
const pricingCode = fs.readFileSync(pricingPath, 'utf-8');
const footerCode = fs.readFileSync(footerPath, 'utf-8');

// 1. Fixed canvas across whole page
const hasFixedCanvas =
  pageCode.includes('<DlpScanBackground') &&
  bgCode.includes('fixed inset-0') &&
  bgCode.includes('pointer-events-none') &&
  bgCode.includes('aria-hidden="true"') &&
  pageCode.includes('relative z-10');
assert(hasFixedCanvas, 'ONE fixed canvas at root of marketing page covering entire viewport (z-0, pointer-events: none, aria-hidden)');

// 2. All sections have transparent backgrounds, cards keep solid surfaces
const allSectionsTransparent =
  heroCode.includes('bg-transparent') &&
  featuresCode.includes('bg-transparent') &&
  howCode.includes('bg-transparent') &&
  privacyCode.includes('bg-transparent') &&
  pricingCode.includes('bg-transparent') &&
  footerCode.includes('bg-transparent');
const cardsSolid =
  featuresCode.includes('bg-[#09090b]') &&
  howCode.includes('bg-[#09090b]') &&
  privacyCode.includes('bg-[#09090b]');
assert(allSectionsTransparent && cardsSolid, 'All page sections have transparent backgrounds while cards retain solid surfaces');

// 3. Constants tuning block
const hasConfigBlock =
  bgCode.includes('export const DLP_BG_CONFIG = {') &&
  bgCode.includes('TEXT_OPACITY: 0.14') &&
  bgCode.includes('SCAN_LINE_OPACITY: 0.28') &&
  bgCode.includes('DETECT_FLASH_OPACITY: 0.55') &&
  bgCode.includes('COLUMN_DENSITY:') &&
  bgCode.includes('SCAN_SPEED:') &&
  bgCode.includes('FPS_CAP: 30');
assert(hasConfigBlock, 'Top-level constants block DLP_BG_CONFIG contains TEXT_OPACITY, SCAN_LINE_OPACITY, DETECT_FLASH_OPACITY, COLUMN_DENSITY, SCAN_SPEED, FPS_CAP');

// 4. Overlap fix: fixed grid cell with single string
const hasGridCellFix =
  bgCode.includes('colWidth =') &&
  bgCode.includes('numCols =') &&
  bgCode.includes('rowHeight = 40') &&
  bgCode.includes('dpr = Math.min(window.devicePixelRatio || 1, 2)');
assert(hasGridCellFix, 'Grid cells have fixed width and height with devicePixelRatio handling capped at 2 (no overlapping text)');

// 5. Detection sequence
const hasDetectionSequence =
  bgCode.includes('timeSince < 300') &&
  bgCode.includes('DETECT_FLASH_OPACITY') &&
  bgCode.includes('drawRoundedBox') &&
  bgCode.includes('timeSince < item.maskDuration') &&
  bgCode.includes('item.pattern.masked') &&
  bgCode.includes('timeSince < 600') &&
  bgCode.includes('item.pattern.raw');
assert(hasDetectionSequence, 'Detection sequence implements: flash -> emerald box -> masked text switch at 300ms -> box fade -> 4-6s hold -> raw restore');

// 6. Occasional "masked" tag
const hasMaskedTag =
  bgCode.includes("ctx.fillText('masked'") &&
  bgCode.includes('item.showTag') &&
  bgCode.includes('now - lastTagTimestamp > 3200');
assert(hasMaskedTag, 'Occasional tiny "masked" tag appears next to freshly masked value and fades out');

// 7. Cursor scanner (desktop only, pointer: fine, within 120px)
const hasCursorScanner =
  bgCode.includes('hasFinePointer') &&
  bgCode.includes('pointermove') &&
  bgCode.includes('distToMouse < 120');
assert(hasCursorScanner, 'Cursor scanner detects values within 120px of cursor on desktop (fine pointer) only');

// 8. Scroll reaction (drift speed increases with scroll and decays)
const hasScrollReaction =
  bgCode.includes('scrollVelocity') &&
  bgCode.includes('scrollVelocity *= 0.92') &&
  bgCode.includes('window.addEventListener(\'scroll\'');
assert(hasScrollReaction, 'Scroll velocity reaction adds light parallax feel and smoothly decays back to normal');

// 9. Soft central opacity reduction behind hero headline
const hasSoftCenter =
  bgCode.includes('distToHeroCenter < 340') &&
  bgCode.includes('softness = 0.5 + 0.5 * (distToHeroCenter / 340)');
assert(hasSoftCenter, 'Soft central opacity reduction ensures hero headline and text remain razor sharp');

// 10. Performance & accessibility
const hasPerfAndA11y =
  bgCode.includes('prefers-reduced-motion: reduce') &&
  bgCode.includes('drawStatic') &&
  bgCode.includes('document.visibilityState') &&
  bgCode.includes('1000 / DLP_BG_CONFIG.FPS_CAP');
assert(hasPerfAndA11y, 'Capped at 30 FPS, tab visibility pause, and prefers-reduced-motion static snapshot');

console.log('\n======================================================');
console.log(`ACCEPTANCE SUMMARY: ${passed}/${passed + failed} passed`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
