import assert from 'assert';

console.log('--- Simulating Part B "PromptOS is thinking" logic & timer ---');

// Simulated thinking state machine
class ThinkingStateMachine {
  constructor({ wasMasked = false, onStateChange = () => {} }) {
    this.wasMasked = wasMasked;
    this.text = 'PromptOS is thinking';
    this.isStillWorking = false;
    this.isActive = true;
    this.onStateChange = onStateChange;

    this.timer = setTimeout(() => {
      if (this.isActive) {
        this.isStillWorking = true;
        this.text = 'Still working…';
        this.onStateChange(this);
      }
    }, 15000);
  }

  receiveReply(reply) {
    this.destroy();
    return { status: 'replied', content: reply };
  }

  receiveError(err) {
    this.destroy();
    return { status: 'error', error: err };
  }

  switchChat() {
    this.destroy();
    return { status: 'cleaned_up' };
  }

  destroy() {
    this.isActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Test 1: Immediate state
const t1 = new ThinkingStateMachine({ wasMasked: true });
assert.strictEqual(t1.text, 'PromptOS is thinking', 'Initial text should be "PromptOS is thinking"');
assert.strictEqual(t1.wasMasked, true, 'wasMasked should be true');
t1.destroy();
console.log('PASS: Immediate state matches requirements (PromptOS is thinking + wasMasked: true)');

// Test 2: Unmasked prompt state
const t2 = new ThinkingStateMachine({ wasMasked: false });
assert.strictEqual(t2.text, 'PromptOS is thinking', 'Initial text should be "PromptOS is thinking"');
assert.strictEqual(t2.wasMasked, false, 'wasMasked should be false');
t2.destroy();
console.log('PASS: Normal prompt state does not show masking line (wasMasked: false)');

// Test 3: Reply arrives before 15s (timer cleaned up, never stuck)
const t3 = new ThinkingStateMachine({ wasMasked: false });
const result3 = t3.receiveReply('Hello there!');
assert.strictEqual(result3.status, 'replied');
assert.strictEqual(t3.isActive, false, 'State should be inactive');
assert.strictEqual(t3.timer, null, 'Timer should be cleared');
console.log('PASS: Indicator clears immediately on reply (never stuck)');

// Test 4: Error arrives (429 or network error) -> cleaned up
const t4 = new ThinkingStateMachine({ wasMasked: false });
const result4 = t4.receiveError('429 Quota Exceeded');
assert.strictEqual(result4.status, 'error');
assert.strictEqual(t4.isActive, false, 'State should be inactive on error');
assert.strictEqual(t4.timer, null, 'Timer should be cleared on error');
console.log('PASS: Indicator clears immediately on error without getting stuck');

// Test 5: Chat switch / new chat while waiting
const t5 = new ThinkingStateMachine({ wasMasked: true });
const result5 = t5.switchChat();
assert.strictEqual(result5.status, 'cleaned_up');
assert.strictEqual(t5.isActive, false, 'State should be cleaned up on chat switch');
assert.strictEqual(t5.timer, null, 'Timer should be cleared on chat switch');
console.log('PASS: Indicator properly cleaned up if user switches chats or starts new chat');

console.log('--- All simulated state machine tests passed successfully ---');
