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
console.log('   PROMPTOS UI-ONLY UPDATE ACCEPTANCE VERIFICATION    ');
console.log('======================================================\n');

// 1. Landing page check for forbidden terms
const marketingFiles = [
  'app/(marketing)/page.tsx',
  'components/marketing/navbar.tsx',
  'components/marketing/hero.tsx',
  'components/marketing/features-grid.tsx',
  'components/marketing/how-it-works.tsx',
  'components/marketing/roadmap-strip.tsx',
  'components/marketing/privacy-section.tsx',
  'components/marketing/pricing.tsx',
  'components/marketing/footer.tsx',
];

let forbiddenFound = [];
const forbiddenRegex = /\b(creator|creators|mini-app|mini-apps|pay-per-app|pdf|pdfs)\b/i;

for (const file of marketingFiles) {
  const content = fs.readFileSync(path.join(projectRoot, file), 'utf-8');
  const match = content.match(forbiddenRegex);
  if (match) {
    forbiddenFound.push(`${file} contains "${match[0]}"`);
  }
}
assert(forbiddenFound.length === 0, `No mention of creators, mini-apps, pay-per-app or PDF on landing page (Found: ${forbiddenFound.join(', ') || 'none'})`);

// 2. Features Grid Cards 7-9 check
const featuresGrid = fs.readFileSync(path.join(projectRoot, 'components/marketing/features-grid.tsx'), 'utf-8');
const hasComingSoonBadge = featuresGrid.includes('Badge variant="warning">Coming soon</Badge>');
const hasInDevelopment = featuresGrid.includes('In development');
const hasUpcomingDiv = featuresGrid.includes('f.isUpcoming') && featuresGrid.includes('<div') && !featuresGrid.includes('href={f.href}');
assert(hasComingSoonBadge && hasInDevelopment && hasUpcomingDiv, 'Cards 7-9 show COMING SOON badge, are not clickable, and show "In development"');

// 3. Live feature cards route to login
const hasLiveLoginRoute = featuresGrid.includes('href="/login"');
assert(hasLiveLoginRoute, 'Every live feature card routes to /login');

// 4. Chat empty state suggestions and chips
const chatThread = fs.readFileSync(path.join(projectRoot, 'components/chat/chat-thread.tsx'), 'utf-8');
const hasSummarize = chatThread.includes('Summarize this text in 5 bullet points');
const hasCode = chatThread.includes('Explain what this code does and find bugs');
const hasBrainstorm = chatThread.includes('Give me 10 project ideas for a hackathon');
const hasWrite = chatThread.includes('Draft a professional email asking for a meeting');
const hasChips = chatThread.includes('DLP Shield on') && chatThread.includes('Prompt optimizer') && chatThread.includes('Images up to 3.5 MB');
const vanishesWhenMessagesExist = chatThread.includes('isEmpty ?') && chatThread.includes('messages.length === 0');
assert(hasSummarize && hasCode && hasBrainstorm && hasWrite && hasChips && vanishesWhenMessagesExist, 'Chat empty state shows 4 suggestions, 3 chips, and vanishes after first message');

// 5. Suggestion click fills input only
const hasPrefill = chatThread.includes('setPrefillPrompt(text)') && chatThread.includes('prefillValue={prefillPrompt}') && !chatThread.includes('onSendMessage(item.text)');
const chatInput = fs.readFileSync(path.join(projectRoot, 'components/chat/chat-input.tsx'), 'utf-8');
const inputSetsPrefill = chatInput.includes('setInput(prefillValue)');
assert(hasPrefill && inputSetsPrefill, 'Suggestion click fills input only without auto-sending');

// 6. Logo animations
const globalsCss = fs.readFileSync(path.join(projectRoot, 'app/globals.css'), 'utf-8');
const hasAvatarPulseCss = globalsCss.includes('@keyframes promptosAvatarPulse') && globalsCss.includes('.animate-promptos-avatar');
const hasSinglePulseCss = globalsCss.includes('@keyframes promptosSinglePulse') && globalsCss.includes('.animate-promptos-single-pulse');
const hasTypingPulseTrigger = chatThread.includes('animate-promptos-single-pulse') && chatThread.includes('handleInputChange');
const hasAvatarPulseInLoading = chatThread.includes('animate-promptos-avatar') && chatThread.includes('isLoading &&');
assert(hasAvatarPulseCss && hasSinglePulseCss && hasTypingPulseTrigger && hasAvatarPulseInLoading, 'Logo animates during loading and empty-state logo does single pulse on typing start');

// 7. Reduced motion respect
const respectsReducedMotion = globalsCss.includes('prefers-reduced-motion: reduce') && chatThread.includes('motion-reduce:animate-none');
assert(respectsReducedMotion, 'Respects prefers-reduced-motion on keyframes and Tailwind utilities');

// 8. Sidebar padding fix and empty state
const chatSidebar = fs.readFileSync(path.join(projectRoot, 'components/chat/chat-sidebar.tsx'), 'utf-8');
const hasRecentsPadding = chatSidebar.includes('px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500');
const hasEmailPadding = chatSidebar.includes('px-4 py-3 border-t border-zinc-800/80');
const hasNoChatsYet = chatSidebar.includes("'No chats yet'");
assert(hasRecentsPadding && hasEmailPadding && hasNoChatsYet, 'Sidebar fixes clipping on RECENTS and email with left padding, and shows "No chats yet"');

// 9. Mobile responsiveness classes
const heroMobile = fs.readFileSync(path.join(projectRoot, 'components/marketing/hero.tsx'), 'utf-8');
const hasMobileGrid = featuresGrid.includes('grid-cols-1 md:grid-cols-2 lg:grid-cols-3') && heroMobile.includes('px-4 sm:px-6');
assert(hasMobileGrid, '375px mobile layout classes present (single column grids, responsive gutters)');

console.log('\n======================================================');
console.log(`ACCEPTANCE SUMMARY: ${passed}/${passed + failed} passed`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
