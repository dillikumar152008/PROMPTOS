import { scanPrompt, maskPrompt, summarize, extractMaxIndices } from '../../src/lib/dlp.js';

export { extractMaxIndices };

/**
 * Server-side DLP storage enforcement:
 * 1. Runs the server-side DLP mask on every message in all cases.
 * 2. Never persists the placeholder-to-original map: not in DB, cookies, localStorage, logs, or server memory.
 * 3. Never logs request bodies, messages, or matched values. Logs category counts only.
 * 4. Supports conversation-scoped baseCounts offset for monotonic placeholder numbering across turns.
 */
export function prepareMessage(text, baseCounts = {}) {
  if (!text) return '';
  const findings = scanPrompt(text);
  if (findings.length > 0) {
    const summary = summarize(findings);
    const countsSummary = summary.map((s) => `${s.label}:${s.count}`).join(', ');
    console.log(`[DLP Server] Masked sensitive categories: ${countsSummary}`);
    return maskPrompt(text, findings, baseCounts).masked;
  }
  return text;
}
