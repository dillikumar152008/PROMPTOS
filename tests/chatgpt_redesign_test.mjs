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
console.log('   PROMPTOS CHATGPT-STYLE REDESIGN ACCEPTANCE TEST    ');
console.log('======================================================\n');

// 1. Roadmap strip removed
const marketingPage = fs.readFileSync(path.join(projectRoot, 'app/(marketing)/page.tsx'), 'utf-8');
const roadmapFileExists = fs.existsSync(path.join(projectRoot, 'components/marketing/roadmap-strip.tsx'));
const hasRoadmapInPage = marketingPage.includes('RoadmapStrip') || marketingPage.includes('roadmap-strip');
assert(!roadmapFileExists && !hasRoadmapInPage, 'Roadmap strip file and imports completely removed from landing page');

// 2. Double border check on marketing page
const howItWorks = fs.readFileSync(path.join(projectRoot, 'components/marketing/how-it-works.tsx'), 'utf-8');
const privacySection = fs.readFileSync(path.join(projectRoot, 'components/marketing/privacy-section.tsx'), 'utf-8');
const hasSingleBorderTransition = howItWorks.includes('border-b border-zinc-800') && !privacySection.includes('border-t');
assert(hasSingleBorderTransition, 'No double border lines or visual gaps between how-it-works and privacy-section');

// 3. Sidebar root-cause fix and date grouping
const sidebar = fs.readFileSync(path.join(projectRoot, 'components/chat/chat-sidebar.tsx'), 'utf-8');
const hasDateGrouping = sidebar.includes('groupConversationsByDate') &&
  sidebar.includes("'Today'") &&
  sidebar.includes("'Yesterday'") &&
  sidebar.includes("'Previous 7 days'") &&
  sidebar.includes("'Older'");
const hasFixedDesktopWidth = sidebar.includes("w-[260px]") && sidebar.includes("shrink-0");
const hasSeparateMobileDrawer = sidebar.includes("fixed inset-0 z-50 md:hidden");
assert(hasDateGrouping && hasFixedDesktopWidth && hasSeparateMobileDrawer, 'Sidebar fixed at source: shrink-0 w-[260px] desktop + clean mobile overlay; grouped by Today/Yesterday/Previous 7 days/Older');

// 4. Empty state: heading, composer, 4 pills only (no logo tile, no subtext, no 2x2 grid, no chips)
const chatThread = fs.readFileSync(path.join(projectRoot, 'components/chat/chat-thread.tsx'), 'utf-8');
const hasHeading = chatThread.includes("What&apos;s on your mind today?") || chatThread.includes("What's on your mind today?");
const hasPills = chatThread.includes('Summarize text') &&
  chatThread.includes('Explain code') &&
  chatThread.includes('Brainstorm ideas') &&
  chatThread.includes('Draft an email');
const hasNoEmptyLogoTile = !chatThread.includes('isLogoPulsing') && !chatThread.includes('animate-promptos-single-pulse');
const hasNoChips = !chatThread.includes('DLP Shield on') && !chatThread.includes('Prompt optimizer');
assert(hasHeading && hasPills && hasNoEmptyLogoTile && hasNoChips, 'Empty state has only centered heading, composer, and 4 pills; old cards, chips, and logo tile removed');

// 5. Pills fill input only and disappear after first message
const pillsFillInput = (chatThread.includes('handleSelectPill') || chatThread.includes('setPrefillPrompt')) && chatThread.includes('prefillValue={prefillPrompt}');
const pillsVanish = chatThread.includes('isEmpty ?') && chatThread.includes('emptyPills.map');
assert(pillsFillInput && pillsVanish, 'Pills fill input only without auto-send and vanish after the first message');

// 6. Composer styling and elements
const chatInput = fs.readFileSync(path.join(projectRoot, 'components/chat/chat-input.tsx'), 'utf-8');
const hasRounded3xl = chatInput.includes('rounded-3xl bg-[#303030]');
const hasDisclaimer = chatInput.includes('PromptOS AI can make mistakes. Verify critical information.');
const hasCircularSend = chatInput.includes('rounded-full') && chatInput.includes('ArrowUp');
const hasOptimizerButton = chatInput.includes('handleOptimize') && chatInput.includes('isOptimizing');
assert(hasRounded3xl && hasDisclaimer && hasCircularSend && hasOptimizerButton, 'Composer has rounded-3xl #303030 container, circular send button, optimizer button, and mistake disclaimer');

// 7. Conversation view (bubble user message, plain assistant message with logo avatar, copy button)
const hasUserBubble = chatThread.includes('rounded-3xl bg-[#303030]');
const hasAssistantPlain = chatThread.includes('flex items-start gap-3.5 justify-start w-full group') &&
  chatThread.includes('&gt;_') &&
  chatThread.includes('ReactMarkdown');
const hasCopyButton = chatThread.includes('handleCopy') && chatThread.includes('Copy') && chatThread.includes('Copied');
const hasLoadingAnimation = chatThread.includes('animate-promptos-avatar') && chatThread.includes('animate-bounce');
assert(hasUserBubble && hasAssistantPlain && hasCopyButton && hasLoadingAnimation, 'Conversation view has rounded user bubbles, plain assistant messages with >_ avatar, copy button, and waiting pulse');

// 8. Top bar: slim bar, hamburger on mobile, expand icon on collapsed desktop, title PromptOS, no borders
const shell = fs.readFileSync(path.join(projectRoot, 'components/chat/chat-layout-shell.tsx'), 'utf-8');
const hasSlimTopBar = shell.includes('h-11') && !shell.includes('border-b') && shell.includes('PromptOS');
const hasCollapseToggle = shell.includes('isCollapsed') && shell.includes('PanelLeft');
assert(hasSlimTopBar && hasCollapseToggle, 'Slim top bar has hamburger, desktop collapse/expand toggle, PromptOS title, and no borders');

// 9. DLP banner and functionality
const dlpBanner = fs.readFileSync(path.join(projectRoot, 'components/user/dlp-banner.tsx'), 'utf-8');
const hasDlpActions = dlpBanner.includes('onMaskAndSend') && dlpBanner.includes('onEdit');
const hasSansFont = !dlpBanner.includes('font-mono');
assert(hasDlpActions && hasSansFont, 'DLP banner retains Mask and send / Edit actions and uses clean sans font');

console.log('\n======================================================');
console.log(`ACCEPTANCE SUMMARY: ${passed}/${passed + failed} passed`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
