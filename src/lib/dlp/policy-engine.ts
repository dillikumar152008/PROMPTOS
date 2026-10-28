// PromptOS DLP Policy Enforcement Engine

import type {
  Finding,
  RiskAnalysis,
  PolicyEvaluation,
  PolicyDecision,
  PolicyViolation,
  DlpPolicyConfig,
} from './types';

export const DEFAULT_POLICY_CONFIG: DlpPolicyConfig = {
  blockThreshold: 85,
  warnThreshold: 35,
  blockOnCritical: true,
  blockOnUnmaskedCards: true,
  blockOnPrivateKeys: true,
  enforceGovtPiiWarn: true,
};

/**
 * Evaluates findings and risk analysis against organizational DLP policies.
 * Clearly separates detection findings from enforcement decisions.
 */
export function evaluatePolicies(
  findings: Finding[],
  risk: RiskAnalysis,
  customConfig?: Partial<DlpPolicyConfig>
): PolicyEvaluation {
  const config: DlpPolicyConfig = {
    ...DEFAULT_POLICY_CONFIG,
    ...(customConfig || {}),
  };

  const violations: PolicyViolation[] = [];
  const reasons: string[] = [];

  // Check 1: Cryptographic Private Keys & Passwords (BLOCK)
  const privateKeys = findings.filter((f) => f.type === 'PRIVATE_KEY');
  if (config.blockOnPrivateKeys && privateKeys.length > 0) {
    violations.push({
      policyId: 'POL-01-KEY-EXFILTRATION',
      policyName: 'Cryptographic Key Exfiltration Protection',
      severity: 'CRITICAL',
      reason: `Detected ${privateKeys.length} raw private key block(s). Transmission strictly blocked.`,
    });
    reasons.push('Prohibited cryptographic private keys detected.');
  }

  const passwords = findings.filter((f) => f.type === 'PASSWORD' || f.type === 'URL_CREDENTIAL');
  if (config.blockOnCritical && passwords.length > 0) {
    violations.push({
      policyId: 'POL-02-PASSWORD-SECURITY',
      policyName: 'Cleartext Credential Protection Policy',
      severity: 'CRITICAL',
      reason: `Detected ${passwords.length} cleartext password(s) or exposed URL credentials.`,
    });
    reasons.push('Prohibited cleartext credentials detected.');
  }

  // Check 2: Production API Keys & Cloud Access Secrets (BLOCK)
  const apiKeys = findings.filter((f) => f.type === 'API_KEY');
  if (config.blockOnCritical && apiKeys.length > 0) {
    violations.push({
      policyId: 'POL-03-API-KEY-LEAK',
      policyName: 'API Secret & Cloud Token Protection',
      severity: 'CRITICAL',
      reason: `Detected ${apiKeys.length} high-entropy API key(s) or access tokens.`,
    });
    reasons.push('High-entropy API keys detected.');
  }

  // Check 3: PCI-DSS Payment Cards (BLOCK)
  const cards = findings.filter((f) => f.type === 'CARD');
  if (config.blockOnUnmaskedCards && cards.length > 0) {
    violations.push({
      policyId: 'POL-04-PCI-DSS-CARDS',
      policyName: 'PCI-DSS Payment Card Data Protection',
      severity: 'CRITICAL',
      reason: `Detected ${cards.length} unmasked credit/debit card number(s).`,
    });
    reasons.push('Payment card numbers detected.');
  }

  // Check 4: Government & National PII (WARN / REQUIRE MASKING)
  const govtPii = findings.filter((f) => f.type === 'AADHAAR' || f.type === 'PAN' || f.type === 'PASSPORT');
  if (config.enforceGovtPiiWarn && govtPii.length > 0) {
    violations.push({
      policyId: 'POL-05-GOVT-PII',
      policyName: 'National Identity PII Protection (Aadhaar / PAN / Passport)',
      severity: 'HIGH',
      reason: `Detected ${govtPii.length} national identity identifier(s). Requires masking before transmission.`,
    });
    reasons.push('National identity identifiers detected.');
  }

  // Check 5: Banking & Financial Data (WARN)
  const bankData = findings.filter((f) => f.type === 'BANK_ACCOUNT' || f.type === 'IFSC');
  if (bankData.length > 0) {
    violations.push({
      policyId: 'POL-06-BANKING-DATA',
      policyName: 'Banking & Financial Data Security',
      severity: 'HIGH',
      reason: `Detected ${bankData.length} bank account or IFSC record(s).`,
    });
    reasons.push('Bank account or IFSC numbers detected.');
  }

  // Check 6: Personal Contact Information (WARN if in bulk)
  const contacts = findings.filter((f) => f.type === 'PHONE' || f.type === 'EMAIL');
  if (contacts.length >= 3) {
    violations.push({
      policyId: 'POL-07-BULK-CONTACT-PII',
      policyName: 'Bulk Contact PII Policy',
      severity: 'MEDIUM',
      reason: `Detected ${contacts.length} email/phone contact entries. Potential customer list exfiltration.`,
    });
    reasons.push('Multiple contact details detected.');
  }

  // Determine Decision:
  // If any CRITICAL violation exists or risk score >= blockThreshold -> BLOCK
  // Else if any HIGH/MEDIUM violation exists or risk score >= warnThreshold -> WARN
  // Else -> ALLOW
  let decision: PolicyDecision = 'ALLOW';
  let policyName = 'Standard Clean Content Policy';
  let recommendedAction = 'No policy violations found. Content is safe for processing.';

  const hasCriticalViolation = violations.some((v) => v.severity === 'CRITICAL');
  const hasHighViolation = violations.some((v) => v.severity === 'HIGH');
  const hasMediumViolation = violations.some((v) => v.severity === 'MEDIUM');

  if (hasCriticalViolation || risk.score >= config.blockThreshold) {
    decision = 'BLOCK';
    policyName = 'Zero-Trust Data Protection Policy (Enforced Block)';
    recommendedAction =
      'Operation prohibited: Remove cryptographic private keys, passwords, payment cards, or API secrets before attempting to process this file.';
  } else if (hasHighViolation || hasMediumViolation || risk.score >= config.warnThreshold) {
    decision = 'WARN';
    policyName = 'Confidential Data Handling Policy (Review / Masking Required)';
    recommendedAction =
      'Sensitive data detected: Enable DLP Shield masking to replace personal identifiers with privacy-preserving tokens before sending.';
  }

  return {
    decision,
    policyName,
    reasons: reasons.length > 0 ? reasons : ['No sensitive patterns identified.'],
    recommendedAction,
    violations,
  };
}
