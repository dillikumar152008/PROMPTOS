/**
 * Phase 1 — Policy Engine (Server-Side Source of Truth)
 *
 * Implements deterministic policy evaluation based on detected categories,
 * detection confidence, and document inspection status.
 *
 * Enforcement Rules:
 *  - block: API keys / cloud secrets, payment cards (zero external transmission).
 *  - sanitize: Aadhaar, PAN, Indian mobile numbers (mandatory masking).
 *  - review: Low-confidence detections or partial document inspection (explicit user confirmation).
 *  - allow: No sensitive findings and complete inspection.
 *
 * Overrides:
 *  - confirmReview may ONLY override "review".
 *  - confirmReview can NEVER override "block", "held", or skip sanitization.
 */

import 'server-only';
import type { Finding } from '@/src/lib/dlp/types';

export const POLICY_VERSION = 'v1.0';

export type PolicyAction = 'allow' | 'sanitize' | 'review' | 'block' | 'held';
export type InspectionStatus = 'complete' | 'partial' | 'failed';

/** Default versioned policy configuration */
export const POLICY_CONFIG = {
  version: POLICY_VERSION,
  // Categories strictly blocked from external model transmission
  blockCategories: ['API_KEY', 'CARD'] as const,
  // Categories permitted with mandatory server-side masking
  sanitizeCategories: ['AADHAAR', 'PAN', 'PHONE'] as const,
  // High-entropy secrets and credential categories (alias mapped)
  credentialCategories: ['PRIVATE_KEY', 'PASSWORD', 'URL_CREDENTIAL'] as const,
};

export interface PolicyContext {
  inspectionStatus?: InspectionStatus;
  confirmReview?: boolean;
  hasRawAttachments?: boolean;
  pagesInspected?: number;
  pagesTotal?: number;
}

export interface PolicyEvaluationResult {
  action: PolicyAction;
  reasons: string[];
  policyVersion: string;
  inspectionStatus: InspectionStatus;
  userOverride: boolean;
  categoryCounts: Record<string, number>;
  blockedCategories: string[];
  sanitizedCategories: string[];
  reviewCategories: string[];
}

/**
 * Evaluates findings and execution context against organizational DLP policies.
 * Never trusts any client-side decision.
 */
export function evaluatePolicy(
  findings: Finding[] = [],
  context: PolicyContext = {}
): PolicyEvaluationResult {
  const inspectionStatus: InspectionStatus = context.inspectionStatus ?? 'complete';
  const confirmReview = Boolean(context.confirmReview);
  const hasRawAttachments = Boolean(context.hasRawAttachments);

  const categoryCounts: Record<string, number> = {};
  for (const f of findings) {
    const t = f.type || 'UNKNOWN';
    categoryCounts[t] = (categoryCounts[t] ?? 0) + 1;
  }

  // 1. Fail-closed: uninspected raw image attachments are blocked by policy
  if (hasRawAttachments) {
    return {
      action: 'held',
      reasons: [
        'Raw image binaries are not permitted by policy. Please extract text locally with OCR before sending.',
      ],
      policyVersion: POLICY_VERSION,
      inspectionStatus: 'failed',
      userOverride: false,
      categoryCounts,
      blockedCategories: [],
      sanitizedCategories: [],
      reviewCategories: [],
    };
  }

  // 2. Fail-closed: failed inspection
  if (inspectionStatus === 'failed') {
    return {
      action: 'held',
      reasons: ['Content inspection failed or timed out. Request cannot proceed.'],
      policyVersion: POLICY_VERSION,
      inspectionStatus: 'failed',
      userOverride: false,
      categoryCounts,
      blockedCategories: [],
      sanitizedCategories: [],
      reviewCategories: [],
    };
  }

  // Identify categories
  const blockedCategories: string[] = [];
  const sanitizedCategories: string[] = [];
  const reviewCategories: string[] = [];

  const blockSet = new Set<string>([
    ...POLICY_CONFIG.blockCategories,
    ...POLICY_CONFIG.credentialCategories,
  ]);
  const sanitizeSet = new Set<string>(POLICY_CONFIG.sanitizeCategories);

  for (const f of findings) {
    const type = f.type;
    if (blockSet.has(type)) {
      if (!blockedCategories.includes(type)) blockedCategories.push(type);
    } else if (sanitizeSet.has(type)) {
      if (!sanitizedCategories.includes(type)) sanitizedCategories.push(type);
    }

    if (f.confidence === 'low') {
      if (!reviewCategories.includes(type)) reviewCategories.push(type);
    }
  }

  // 3. BLOCK enforcement: Prohibited categories (API keys, secrets, payment cards)
  // confirmReview MUST NEVER override a block.
  if (blockedCategories.length > 0) {
    const blockedLabels = blockedCategories
      .map((c) => (c === 'API_KEY' ? 'API keys' : c === 'CARD' ? 'Payment cards' : c))
      .join(', ');
    return {
      action: 'block',
      reasons: [
        `Prohibited high-risk data detected (${blockedLabels}). Transmission to external AI models is strictly blocked by policy.`,
      ],
      policyVersion: POLICY_VERSION,
      inspectionStatus,
      userOverride: false, // Override is rejected on block
      categoryCounts,
      blockedCategories,
      sanitizedCategories,
      reviewCategories,
    };
  }

  // 4. REVIEW enforcement: Partial inspection or low-confidence findings
  const isPartial = inspectionStatus === 'partial';
  const hasLowConfidence = reviewCategories.length > 0;

  if (isPartial || hasLowConfidence) {
    const reviewReasons: string[] = [];
    if (isPartial) {
      reviewReasons.push(
        'Partial document inspection: one or more pages/regions were unreadable or OCR yielded no text.'
      );
    }
    if (hasLowConfidence) {
      reviewReasons.push(
        `Low-confidence detections require confirmation (${reviewCategories.join(', ')}).`
      );
    }

    // Check if user confirmed the review
    if (confirmReview) {
      // Review overridden: if sanitize categories also exist, MUST still sanitize!
      if (sanitizedCategories.length > 0) {
        return {
          action: 'sanitize',
          reasons: [
            ...reviewReasons.map((r) => `${r} (Acknowledged by user)`),
            `Sensitive data detected (${sanitizedCategories.join(', ')}). Values will be masked before sending.`,
          ],
          policyVersion: POLICY_VERSION,
          inspectionStatus,
          userOverride: true,
          categoryCounts,
          blockedCategories: [],
          sanitizedCategories,
          reviewCategories,
        };
      }

      return {
        action: 'allow',
        reasons: reviewReasons.map((r) => `${r} (Acknowledged by user)`),
        policyVersion: POLICY_VERSION,
        inspectionStatus,
        userOverride: true,
        categoryCounts,
        blockedCategories: [],
        sanitizedCategories: [],
        reviewCategories,
      };
    }

    // Review not confirmed -> action = review
    return {
      action: 'review',
      reasons: reviewReasons,
      policyVersion: POLICY_VERSION,
      inspectionStatus,
      userOverride: false,
      categoryCounts,
      blockedCategories: [],
      sanitizedCategories,
      reviewCategories,
    };
  }

  // 5. SANITIZE enforcement: Aadhaar, PAN, Indian mobile numbers
  if (sanitizedCategories.length > 0) {
    return {
      action: 'sanitize',
      reasons: [
        `Sensitive personal data detected (${sanitizedCategories.join(', ')}). Values will be masked before sending.`,
      ],
      policyVersion: POLICY_VERSION,
      inspectionStatus,
      userOverride: false,
      categoryCounts,
      blockedCategories: [],
      sanitizedCategories,
      reviewCategories: [],
    };
  }

  // 6. ALLOW: Clean content and complete inspection
  return {
    action: 'allow',
    reasons: ['Inspection complete. No sensitive data detected.'],
    policyVersion: POLICY_VERSION,
    inspectionStatus: 'complete',
    userOverride: false,
    categoryCounts,
    blockedCategories: [],
    sanitizedCategories: [],
    reviewCategories: [],
  };
}
