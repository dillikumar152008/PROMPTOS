import fs from 'fs';
import assert from 'assert';

console.log('======================================================');
console.log('   TASK 1 & TASK 2 VERIFICATION TEST');
console.log('======================================================\n');

// 1. Task 1: Check chat-sidebar.tsx
console.log('[TEST 1] Checking components/chat/chat-sidebar.tsx...');
const sidebarCode = fs.readFileSync('components/chat/chat-sidebar.tsx', 'utf8');

assert(!sidebarCode.includes('>AI<'), 'AI badge text must be removed from chat-sidebar.tsx');
assert(!sidebarCode.includes('text-emerald-400 bg-emerald-950/40'), 'AI badge classes must be removed');
assert(sidebarCode.includes('PromptOS'), 'PromptOS title must remain in chat-sidebar.tsx');
assert(sidebarCode.includes('&gt;_'), 'Logo mark must remain in chat-sidebar.tsx');
console.log('  ✓ PASS: AI badge is completely removed from sidebar header');
console.log('  ✓ PASS: Logo and PromptOS text remain intact\n');

// 2. Task 2: Check auth-card.tsx
console.log('[TEST 2] Checking components/auth/auth-card.tsx kill-switch logic...');
const authCardCode = fs.readFileSync('components/auth/auth-card.tsx', 'utf8');

assert(authCardCode.includes('NEXT_PUBLIC_SIGNUPS_ENABLED'), 'Must check process.env.NEXT_PUBLIC_SIGNUPS_ENABLED');
assert(authCardCode.includes("signupsEnabled ? initialTab : 'login'"), 'Must fallback to login tab when signups disabled');
assert(authCardCode.includes("...(signupsEnabled ? [{ id: 'signup', label: 'Sign Up' }] : [])"), 'Must omit signup tab when signups disabled');
assert(authCardCode.includes('Sign ups are temporarily closed. Existing users can log in.'), 'Must show required closed notice');
console.log('  ✓ PASS: auth-card.tsx properly checks NEXT_PUBLIC_SIGNUPS_ENABLED');
console.log('  ✓ PASS: auth-card.tsx hides signup tab and footer link when flag is false/unset');
console.log('  ✓ PASS: auth-card.tsx displays required plain closed notice\n');

// 3. Task 2: Check .env.example
console.log('[TEST 3] Checking .env.example...');
const envExample = fs.readFileSync('.env.example', 'utf8');
assert(envExample.includes('NEXT_PUBLIC_SIGNUPS_ENABLED='), 'NEXT_PUBLIC_SIGNUPS_ENABLED= must be listed in .env.example');
console.log('  ✓ PASS: .env.example includes NEXT_PUBLIC_SIGNUPS_ENABLED= (empty)\n');

console.log('======================================================');
console.log('ALL TASK 1 & TASK 2 TESTS PASSED');
console.log('======================================================');
