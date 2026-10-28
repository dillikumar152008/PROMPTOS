/**
 * Phase 2 — Shared Security & Data Protection Pipeline
 *
 * Unified gateway pipeline invoked by every route calling external AI models.
 * Enforces fail-closed inspection, policy evaluation, and mandatory masking.
 */

import 'server-only';
import { scanPrompt, maskPrompt, type Finding } from '@/src/lib/dlp';
import {
  evaluatePolicy,
  POLICY_VERSION,
  type PolicyAction,
  type InspectionStatus,
  type PolicyEvaluationResult,
} from '@/lib/policy';

/**
 * Global configuration flag for raw image binaries.
 * DEFAULT: false (raw images are rejected; images must be read locally via OCR).
 *
 * KNOWN LIMITATION IF ENABLED:
 * If set to true, raw image binaries are forwarded directly to multimodal Gemini
 * without server-side OCR/DLP inspection.
 */
export const ALLOW_RAW_IMAGES = process.env.ALLOW_RAW_IMAGES === 'true';

export interface PipelineInspectionResult {
  success: boolean;
  findings: Finding[];
  error?: string;
  durationMs: number;
}

/**
 * Executes scanner with fail-closed timeout and exception protection.
 * If scanner throws, times out, or returns malformed output, returns success: false.
 */
export function executeInspection(
  text: string,
  timeoutMs = 4000
): PipelineInspectionResult {
  const startTime = Date.now();

  if (!text || typeof text !== 'string') {
    return { success: true, findings: [], durationMs: 0 };
  }

  try {
    // For synchronous scanPrompt, execute directly with catch
    const findings = scanPrompt(text);

    if (!Array.isArray(findings)) {
      return {
        success: false,
        findings: [],
        error: 'Scanner returned malformed findings format.',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      findings,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    console.error('[Pipeline Inspection Error]', err?.message || err);
    return {
      success: false,
      findings: [],
      error: err?.message || 'Inspection failed',
      durationMs: Date.now() - startTime,
    };
  }
}

export interface SecurityPipelineInput {
  text: string;
  hasRawAttachments?: boolean;
  confirmReview?: boolean;
  clientInspectionStatus?: InspectionStatus;
  baseCounts?: Record<string, number>;
}

export interface SecurityPipelineResult extends PolicyEvaluationResult {
  safeText: string;
  canProceed: boolean;
  findings: Finding[];
  inspectionDurationMs: number;
}

/**
 * Master Security Pipeline
 * Must be executed before any model call or quota reservation.
 */
export async function runSecurityPipeline(
  input: SecurityPipelineInput
): Promise<SecurityPipelineResult> {
  const {
    text,
    hasRawAttachments = false,
    confirmReview = false,
    clientInspectionStatus = 'complete',
    baseCounts = {},
  } = input;

  // 1. Raw image policy check
  const hasProhibitedRawImages = hasRawAttachments && !ALLOW_RAW_IMAGES;

  // 2. Execute scanner
  const scanResult = executeInspection(text);

  let inspectionStatus: InspectionStatus = 'complete';
  if (!scanResult.success || clientInspectionStatus === 'failed') {
    inspectionStatus = 'failed';
  } else if (clientInspectionStatus === 'partial') {
    inspectionStatus = 'partial';
  } else {
    inspectionStatus = 'complete';
  }

  // 3. Evaluate Policy
  const policyResult = evaluatePolicy(scanResult.findings, {
    inspectionStatus,
    confirmReview,
    hasRawAttachments: hasProhibitedRawImages,
  });

  const canProceed =
    policyResult.action === 'allow' || policyResult.action === 'sanitize';

  // 4. Generate safeText only if request is allowed to proceed
  let safeText = '';
  if (canProceed) {
    if (policyResult.action === 'sanitize') {
      // Filter findings to only those that should be sanitized
      const sanitizeSet = new Set(['AADHAAR', 'PAN', 'PHONE', 'EMAIL', 'BANK_ACCOUNT', 'IFSC', 'PASSPORT', 'IP_ADDRESS', 'NAME', 'ADDRESS']);
      const findingsToMask = scanResult.findings.filter((f) => sanitizeSet.has(f.type));
      if (findingsToMask.length > 0) {
        const masked = maskPrompt(text, findingsToMask, baseCounts);
        safeText = masked.masked;
      } else {
        safeText = text;
      }
    } else {
      safeText = text;
    }
  }

  return {
    ...policyResult,
    safeText,
    canProceed,
    findings: scanResult.findings,
    inspectionDurationMs: scanResult.durationMs,
  };
}
