import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- Verifying Chat Polish Implementation ---');

// 1. Check globals.css
const globalsCss = fs.readFileSync('app/globals.css', 'utf-8');
assert(!globalsCss.includes('animate-promptos-avatar'), 'Old animate-promptos-avatar class should be removed');
assert(globalsCss.includes('@keyframes thinkingShimmer'), 'Keyframes thinkingShimmer should exist');
assert(globalsCss.includes('.animate-thinking-shimmer'), '.animate-thinking-shimmer class should exist');
assert(globalsCss.includes('-webkit-background-clip: text'), 'Should have background-clip text for shimmer');
console.log('PASS: globals.css thinking shimmer styles and cleanup');

// 2. Check chat-layout-shell.tsx (Top Bar Model Selector)
const shellTsx = fs.readFileSync('components/chat/chat-layout-shell.tsx', 'utf-8');
assert(shellTsx.includes('Gemini Flash'), 'Should show Gemini Flash in top bar');
assert(shellTsx.includes('ChevronDown'), 'Should have chevron icon on model trigger');
assert(shellTsx.includes('Multi-model comparison'), 'Should have Multi-model comparison option');
assert(shellTsx.includes('Smart routing'), 'Should have Smart routing option');
assert(shellTsx.includes('Coming soon'), 'Should have Coming soon labels for inactive options');
assert(shellTsx.includes('Escape'), 'Should handle Escape key to close popover');
console.log('PASS: chat-layout-shell.tsx model selector dropdown');

// 3. Check chat-input.tsx (Composer & Attach Menu & DLP Status Line)
const inputTsx = fs.readFileSync('components/chat/chat-input.tsx', 'utf-8');
assert(inputTsx.includes('rounded-3xl'), 'Composer should be rounded-3xl');
assert(inputTsx.includes('focus-within:border-[#4a4a4a]'), 'Composer should have subtle focus-within border');
assert(inputTsx.includes('outline-none') && inputTsx.includes('focus:ring-0'), 'Textarea should not have blue focus ring');
assert(inputTsx.includes('text-base') && inputTsx.includes('placeholder:text-base'), 'Should have 16px text-base placeholder');
assert(inputTsx.includes('min-h-[48px]'), 'Should have taller min-height for textarea');
assert(inputTsx.includes('Add images'), 'Attach popover should have Add images');
assert(inputTsx.includes('Add documents (OCR)'), 'Attach popover should have Add documents (OCR)');
assert(inputTsx.includes('DLP Shield is on. Aadhaar, PAN, cards, phone numbers and API keys are masked before sending.'), 'Should have DLP status line 1');
assert(inputTsx.includes('PromptOS AI can make mistakes. Verify critical information.'), 'Should have DLP status line 2');
console.log('PASS: chat-input.tsx composer, attach popover, and DLP status lines');

// 4. Check chat-thread.tsx (Greeting, 6 pills, and Thinking State)
const threadTsx = fs.readFileSync('components/chat/chat-thread.tsx', 'utf-8');
assert(threadTsx.includes("What's on your mind today?") || threadTsx.includes("What&apos;s on your mind today?"), 'Heading should be present');
assert(threadTsx.includes('Good morning') && threadTsx.includes('Good afternoon') && threadTsx.includes('Good evening'), 'Time-based greeting logic should be present');
assert(threadTsx.includes('Summarize text'), 'Pill 1 Summarize text');
assert(threadTsx.includes('Explain code'), 'Pill 2 Explain code');
assert(threadTsx.includes('Brainstorm ideas'), 'Pill 3 Brainstorm ideas');
assert(threadTsx.includes('Draft an email'), 'Pill 4 Draft an email');
assert(threadTsx.includes('Analyze an image'), 'Pill 5 Analyze an image');
assert(threadTsx.includes('Improve my prompt'), 'Pill 6 Improve my prompt');
assert(threadTsx.includes('Improve this prompt: '), 'Improve my prompt should have starter text');
assert(threadTsx.includes('PromptOS is thinking'), 'Thinking state text should be present');
assert(threadTsx.includes('Still working…'), 'Still working… fallback after 15s should be present');
assert(threadTsx.includes('Sensitive data was masked before sending'), 'Real DLP masking notice line should be present');
assert(threadTsx.includes('role="status"') && threadTsx.includes('aria-live="polite"'), 'Accessibility role and aria-live should be present');
assert(!threadTsx.includes('animate-bounce'), 'Old 3 bouncing dots should be removed');
console.log('PASS: chat-thread.tsx greeting, 6 pills, and PromptOS is thinking state');

// 5. Check app/chat/page.tsx and app/chat/[id]/page.tsx (Masking state wiring)
const chatPage = fs.readFileSync('app/chat/page.tsx', 'utf-8');
const chatConvPage = fs.readFileSync('app/chat/[id]/page.tsx', 'utf-8');
assert(chatPage.includes('wasMasked={wasLastMasked}'), 'Chat page should pass wasMasked to ChatThread');
assert(chatConvPage.includes('wasMasked={wasLastMasked}'), 'Conversation page should pass wasMasked to ChatThread');
console.log('PASS: app/chat/page.tsx & app/chat/[id]/page.tsx masking propagation');

console.log('\nALL 5 IMPLEMENTATION CHECKS PASSED!');
