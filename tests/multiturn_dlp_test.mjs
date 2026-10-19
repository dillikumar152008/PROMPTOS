// ==============================================================================
// SYNTHETIC TEST SUITE: ALL DATA BELOW IS 100% SYNTHETIC AND FOR TESTING ONLY.
// ZERO REAL PERSONAL DATA, PASSWORDS, OR SECRETS ARE STORED OR TESTED.
// ==============================================================================

import { scanPrompt, maskPrompt, restorePlaceholders, extractMaxIndices } from '../src/lib/dlp.js';
import { prepareMessage } from '../lib/chat/prepare.js';

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
console.log('   PROMPTOS MULTI-TURN CONVERSATION-SCOPED DLP TEST');
console.log('   (Two turns in one conversation with different Aadhaar numbers)');
console.log('======================================================\n');

async function runMultiTurnTest() {
  // Synthetic Aadhaar numbers (Verhoeff checksum valid)
  const AADHAAR_TURN_1 = '2345 6789 0124';
  const AADHAAR_TURN_2 = '3456 7890 1238';

  // In-memory conversation state in browser
  const conversationMap = {};
  const conversationMessages = [];

  // ==========================================
  // TURN 1: First user message with Aadhaar 1
  // ==========================================
  console.log('[TURN 1] User inputs first Aadhaar...');
  const inputTurn1 = `My primary Aadhaar is ${AADHAAR_TURN_1}. Please confirm.`;

  // Client scans and extracts baseCounts from conversation history (empty initially)
  const baseCountsTurn1 = extractMaxIndices(conversationMessages.map((m) => m.content));
  assert(
    Object.keys(baseCountsTurn1).length === 0,
    'Turn 1 client baseCounts is empty for new conversation'
  );

  const findingsTurn1 = scanPrompt(inputTurn1);
  assert(findingsTurn1.length === 1, 'Turn 1 detected 1 Aadhaar finding');

  const { masked: maskedTurn1, map: mapTurn1 } = maskPrompt(inputTurn1, findingsTurn1, baseCountsTurn1);
  assert(maskedTurn1.includes('[AADHAAR_1]'), 'Turn 1 masked prompt contains [AADHAAR_1]');
  assert(mapTurn1['[AADHAAR_1]'] === AADHAAR_TURN_1, 'Turn 1 map maps [AADHAAR_1] to first Aadhaar');

  // Client merges into conversation-level map
  Object.assign(conversationMap, mapTurn1);
  conversationMessages.push({ role: 'user', content: maskedTurn1 });

  // Server processes Turn 1:
  const serverHistoryTurn1 = [];
  const serverBaseCountsTurn1 = extractMaxIndices(serverHistoryTurn1.map((m) => m.content));
  const serverSafeUserMsgTurn1 = prepareMessage(maskedTurn1, serverBaseCountsTurn1);
  assert(
    serverSafeUserMsgTurn1 === maskedTurn1,
    'Server preserves masked text with identical [AADHAAR_1] placeholder'
  );

  // Model responds to Turn 1:
  const modelReplyTurn1 = 'I have noted your primary Aadhaar [AADHAAR_1]. How else can I help?';
  const serverSafeAssistantMsgTurn1 = prepareMessage(modelReplyTurn1, serverBaseCountsTurn1);
  conversationMessages.push({ role: 'assistant', content: serverSafeAssistantMsgTurn1 });

  // Client restores Turn 1 response:
  const restoredReplyTurn1 = restorePlaceholders(serverSafeAssistantMsgTurn1, conversationMap);
  console.log('  Restored Turn 1 Reply:', restoredReplyTurn1);
  assert(
    restoredReplyTurn1.includes(AADHAAR_TURN_1),
    'Restored Turn 1 reply contains first Aadhaar number'
  );
  assert(
    !restoredReplyTurn1.includes('[AADHAAR_1]'),
    'Restored Turn 1 reply contains no [AADHAAR_1] placeholder'
  );

  // ==========================================
  // TURN 2: Second user message with Aadhaar 2
  // ==========================================
  console.log('\n[TURN 2] User inputs second Aadhaar in same conversation...');
  const inputTurn2 = `My spouse's Aadhaar is ${AADHAAR_TURN_2}. Can you compare it with my first one?`;

  // Client extracts baseCounts from conversation history:
  const baseCountsTurn2 = extractMaxIndices(conversationMessages.map((m) => m.content));
  assert(baseCountsTurn2['AADHAAR'] === 1, 'Turn 2 client baseCounts has AADHAAR=1 from history');

  const findingsTurn2 = scanPrompt(inputTurn2);
  assert(findingsTurn2.length === 1, 'Turn 2 detected 1 Aadhaar finding');

  // Client masks with baseCounts offset -> MUST produce [AADHAAR_2]
  const { masked: maskedTurn2, map: mapTurn2 } = maskPrompt(inputTurn2, findingsTurn2, baseCountsTurn2);
  assert(
    maskedTurn2.includes('[AADHAAR_2]'),
    'Turn 2 masked prompt uses incremented [AADHAAR_2] placeholder'
  );
  assert(
    !maskedTurn2.includes('[AADHAAR_1]'),
    'Turn 2 masked prompt does NOT collide with [AADHAAR_1]'
  );
  assert(
    mapTurn2['[AADHAAR_2]'] === AADHAAR_TURN_2,
    'Turn 2 map maps [AADHAAR_2] to second Aadhaar'
  );

  // Client updates conversation map
  Object.assign(conversationMap, mapTurn2);
  assert(
    conversationMap['[AADHAAR_1]'] === AADHAAR_TURN_1 && conversationMap['[AADHAAR_2]'] === AADHAAR_TURN_2,
    'Conversation map simultaneously holds both [AADHAAR_1] and [AADHAAR_2] without overwrite'
  );
  conversationMessages.push({ role: 'user', content: maskedTurn2 });

  // Server processes Turn 2:
  const serverHistoryTurn2 = [
    { role: 'user', content: maskedTurn1 },
    { role: 'assistant', content: serverSafeAssistantMsgTurn1 },
  ];
  const serverBaseCountsTurn2 = extractMaxIndices(serverHistoryTurn2.map((m) => m.content));
  assert(
    serverBaseCountsTurn2['AADHAAR'] === 1,
    'Server history extraction produces identical baseCounts AADHAAR=1'
  );

  const serverSafeUserMsgTurn2 = prepareMessage(maskedTurn2, serverBaseCountsTurn2);
  assert(
    serverSafeUserMsgTurn2.includes('[AADHAAR_2]'),
    'Server safeUserMessage keeps [AADHAAR_2]'
  );

  // Even if client sent raw unmasked text (bypassing client UI), server logic also produces [AADHAAR_2]:
  const serverBypassMasked = prepareMessage(inputTurn2, serverBaseCountsTurn2);
  assert(
    serverBypassMasked.includes('[AADHAAR_2]'),
    'Server prepareMessage with baseCounts produces [AADHAAR_2] even on raw input bypass'
  );

  // Model responds referencing BOTH placeholders in its reply:
  const modelReplyTurn2 =
    'Your primary Aadhaar is [AADHAAR_1], and your spouse\'s Aadhaar is [AADHAAR_2]. Both are verified.';
  const assistantBaseCountsTurn2 = extractMaxIndices([
    ...serverHistoryTurn2.map((m) => m.content),
    serverSafeUserMsgTurn2,
  ]);
  assert(
    assistantBaseCountsTurn2['AADHAAR'] === 2,
    'Assistant baseCounts correctly tracks 2 total Aadhaar placeholders'
  );

  const serverSafeAssistantMsgTurn2 = prepareMessage(modelReplyTurn2, assistantBaseCountsTurn2);
  conversationMessages.push({ role: 'assistant', content: serverSafeAssistantMsgTurn2 });

  // Client restores Turn 2 response using cumulative conversationMap:
  const restoredReplyTurn2 = restorePlaceholders(serverSafeAssistantMsgTurn2, conversationMap);
  console.log('  Restored Turn 2 Reply:', restoredReplyTurn2);

  assert(
    restoredReplyTurn2.includes(AADHAAR_TURN_1),
    'Restored Turn 2 reply contains first Aadhaar value (2345 6789 0124)'
  );
  assert(
    restoredReplyTurn2.includes(AADHAAR_TURN_2),
    'Restored Turn 2 reply contains second Aadhaar value (3456 7890 1238)'
  );
  assert(
    !restoredReplyTurn2.includes('[AADHAAR_1]') && !restoredReplyTurn2.includes('[AADHAAR_2]'),
    'Restored Turn 2 reply contains NO un-restored placeholders'
  );

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('======================================================\n');

  if (failedTests > 0) process.exit(1);
}

runMultiTurnTest().catch((err) => {
  console.error('Multi-turn test failed:', err);
  process.exit(1);
});
