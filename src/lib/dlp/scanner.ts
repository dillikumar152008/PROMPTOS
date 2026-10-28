// PromptOS DLP Unified Scanner Orchestrator

import { detectAllEntities, LABELS, getAllMatches } from './patterns';
import { calculateRisk } from './risk-engine';
import { evaluatePolicies, DEFAULT_POLICY_CONFIG } from './policy-engine';
import { verhoeffValid, luhnValid, identifyCardBrand, generateMaskedDisplay } from './checksums';
import type {
  Finding,
  SummaryItem,
  ScanResult,
  DlpPolicyConfig,
  FindingType,
} from './types';

export * from './types';
export * from './checksums';
export * from './patterns';
export * from './risk-engine';
export * from './policy-engine';

/**
 * Scans raw prompt string and returns all detected sensitive data findings.
 * 100% backward compatible with existing PromptOS chat & optimizer callers.
 */
export function scanPrompt(raw: string): Finding[] {
  return detectAllEntities(raw);
}

/**
 * Complete document scan returning full risk analysis, policy decisions,
 * findings breakdown, and audit metadata.
 */
export function scanDocument(
  text: string,
  options?: {
    filename?: string;
    fileType?: string;
    fileSize?: number;
    customConfig?: Partial<DlpPolicyConfig>;
  }
): ScanResult {
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  const findings = scanPrompt(text || '');
  const summary = summarize(findings);
  const risk = calculateRisk(findings);
  const policy = evaluatePolicies(findings, risk, options?.customConfig);

  return {
    scanId,
    timestamp,
    sourceType: options?.filename ? 'file' : 'text',
    filename: options?.filename,
    fileType: options?.fileType || (options?.filename ? options.filename.split('.').pop() : 'text'),
    fileSize: options?.fileSize,
    textLength: (text || '').length,
    findings,
    summary,
    risk,
    policy,
  };
}

/**
 * Extracts max placeholder indices per category from conversation history or texts.
 * Used for monotonic placeholder numbering across turns (e.g. [AADHAAR_1], [AADHAAR_2]).
 */
export function extractMaxIndices(textOrArray: string | string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const texts = Array.isArray(textOrArray) ? textOrArray : [textOrArray || ''];
  const regex = /\[([A-Z_]+)_(\d+)\]/g;
  for (const t of texts) {
    if (!t || typeof t !== 'string') continue;
    for (const m of getAllMatches(t, regex)) {
      const type = m[1];
      const num = parseInt(m[2], 10);
      if (!isNaN(num)) {
        counts[type] = Math.max(counts[type] || 0, num);
      }
    }
  }
  return counts;
}

/**
 * Replaces sensitive findings with structured placeholders (e.g. [AADHAAR_1], [CARD_1]).
 * Returns the masked text and the in-memory restoration map.
 * Never persists the map to disk or database.
 */
export function maskPrompt(
  raw: string,
  findings: Finding[],
  baseCounts: Record<string, number> = {}
): { masked: string; map: Record<string, string> } {
  if (!raw) return { masked: '', map: {} };
  if (!findings || findings.length === 0) return { masked: raw, map: {} };

  const counts = { ...baseCounts };
  const items = findings.map((f) => {
    counts[f.type] = (counts[f.type] || 0) + 1;
    const placeholder = `[${f.type}_${counts[f.type]}]`;
    return { ...f, placeholder };
  });

  let masked = raw;
  // Apply in reverse order so character offsets do not drift during replacement
  for (const it of [...items].reverse()) {
    masked = masked.slice(0, it.start) + it.placeholder + masked.slice(it.end);
  }

  const map: Record<string, string> = {};
  items.forEach((it) => {
    map[it.placeholder] = it.value;
  });

  return { masked, map };
}

/**
 * Restores structured placeholders in the assistant reply using the in-memory map.
 * Runs in the browser only.
 */
export function restorePlaceholders(text: string, map: Record<string, string>): string {
  if (!text) return '';
  if (!map || Object.keys(map).length === 0) return text;
  let out = text;
  for (const [ph, val] of Object.entries(map)) {
    out = out.split(ph).join(val);
  }
  return out;
}

/**
 * Summarizes findings by category count and highest severity for warning banners.
 */
export function summarize(findings: Finding[]): SummaryItem[] {
  if (!findings || findings.length === 0) return [];
  const map: Record<string, { count: number; label: string; severity?: any }> = {};

  for (const f of findings) {
    if (!map[f.type]) {
      map[f.type] = {
        count: 0,
        label: LABELS[f.type] || f.label || f.type,
        severity: f.severity,
      };
    }
    map[f.type].count++;
  }

  return Object.entries(map).map(([type, data]) => ({
    type,
    label: data.label,
    count: data.count,
    severity: data.severity,
  }));
}
