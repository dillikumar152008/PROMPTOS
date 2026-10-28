// PromptOS DLP Risk Calculation and Document Classification Engine

import type { Finding, RiskAnalysis, DocumentClassification, SeverityLevel } from './types';

export const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  CRITICAL: 35,
  HIGH: 20,
  MEDIUM: 10,
  LOW: 4,
};

export const CONFIDENCE_MULTIPLIERS = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

/**
 * Calculates a normalized risk score (0-100), risk severity, and document classification.
 * Formula is deterministic, transparent, and tested against edge cases.
 */
export function calculateRisk(findings: Finding[]): RiskAnalysis {
  if (!findings || findings.length === 0) {
    return {
      score: 0,
      level: 'LOW',
      classification: 'PUBLIC',
      breakdown: {
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
      explanation: 'No sensitive data or policy violations detected. Clean content.',
    };
  }

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  let rawScore = 0;

  for (const f of findings) {
    const severity = f.severity || 'MEDIUM';
    const confidence = f.confidence || 'high';

    const weight = SEVERITY_WEIGHTS[severity];
    const mult = CONFIDENCE_MULTIPLIERS[confidence];
    rawScore += weight * mult;

    if (severity === 'CRITICAL') criticalCount++;
    else if (severity === 'HIGH') highCount++;
    else if (severity === 'MEDIUM') mediumCount++;
    else lowCount++;
  }

  // Scale and apply safety minimum thresholds:
  // 1. Any high-confidence CRITICAL item (private key, active API key, credit card) elevates baseline to at least 85 (CRITICAL).
  // 2. Any high-confidence HIGH item (Aadhaar, PAN, Bank account, Passport) elevates baseline to at least 60 (HIGH).
  let score = Math.round(rawScore);

  if (criticalCount > 0) {
    score = Math.max(score, 85);
  } else if (highCount > 0) {
    score = Math.max(score, 60);
  } else if (mediumCount > 0) {
    score = Math.max(score, 30);
  }

  // Cap at 100
  score = Math.min(100, score);

  // Determine Overall Risk Level
  let level: SeverityLevel = 'LOW';
  if (score >= 85) level = 'CRITICAL';
  else if (score >= 60) level = 'HIGH';
  else if (score >= 30) level = 'MEDIUM';
  else level = 'LOW';

  // Determine Document Classification
  let classification: DocumentClassification = 'PUBLIC';
  if (criticalCount > 0 || score >= 75) {
    classification = 'RESTRICTED';
  } else if (highCount > 0 || mediumCount >= 3 || score >= 45) {
    classification = 'CONFIDENTIAL';
  } else if (mediumCount > 0 || lowCount > 0 || score >= 15) {
    classification = 'INTERNAL';
  } else {
    classification = 'PUBLIC';
  }

  // Construct readable explanation
  const parts: string[] = [];
  if (criticalCount > 0) {
    parts.push(`${criticalCount} critical secret/credential violation(s)`);
  }
  if (highCount > 0) {
    parts.push(`${highCount} high-sensitivity national/financial identifier(s)`);
  }
  if (mediumCount > 0) {
    parts.push(`${mediumCount} medium-sensitivity personal identifier(s)`);
  }
  if (lowCount > 0) {
    parts.push(`${lowCount} low-sensitivity context finding(s)`);
  }

  const explanation = `Document scored ${score}/100 (${level} Risk, Classified ${classification}) based on ${parts.join(', ')}.`;

  return {
    score,
    level,
    classification,
    breakdown: {
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    },
    explanation,
  };
}
