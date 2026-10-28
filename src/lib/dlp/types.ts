// PromptOS DLP Types and Interfaces

export type FindingType =
  | 'AADHAAR'
  | 'PAN'
  | 'PHONE'
  | 'CARD'
  | 'EMAIL'
  | 'API_KEY'
  | 'PASSWORD'
  | 'PRIVATE_KEY'
  | 'BANK_ACCOUNT'
  | 'IFSC'
  | 'PASSPORT'
  | 'IP_ADDRESS'
  | 'URL_CREDENTIAL'
  | 'NAME'
  | 'ADDRESS';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type PolicyDecision = 'ALLOW' | 'WARN' | 'BLOCK';

export type DocumentClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface Finding {
  type: FindingType | string;
  label?: string;
  start: number;
  end: number;
  confidence: ConfidenceLevel;
  value: string;
  maskedValue?: string;
  placeholder?: string;
  severity?: SeverityLevel;
  detectionMethod?: string;
  explanation?: string;
  metadata?: Record<string, any>;
  location?: {
    line?: number;
    column?: number;
    page?: number;
  };
}

export interface SummaryItem {
  type: string;
  label: string;
  count: number;
  severity?: SeverityLevel;
}

export interface RiskAnalysis {
  score: number; // 0 - 100
  level: SeverityLevel;
  classification: DocumentClassification;
  breakdown: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  explanation: string;
}

export interface PolicyViolation {
  policyId: string;
  policyName: string;
  severity: SeverityLevel;
  reason: string;
}

export interface PolicyEvaluation {
  decision: PolicyDecision;
  policyName: string;
  reasons: string[];
  recommendedAction: string;
  violations: PolicyViolation[];
}

export interface ScanResult {
  scanId: string;
  timestamp: string;
  sourceType: 'text' | 'file';
  filename?: string;
  fileType?: string;
  fileSize?: number;
  textLength: number;
  findings: Finding[];
  summary: SummaryItem[];
  risk: RiskAnalysis;
  policy: PolicyEvaluation;
  maskedText?: string;
}

export interface AuditLogEntry {
  id: string;
  scanId: string;
  userId?: string;
  userEmail?: string;
  timestamp: string;
  sourceType: 'text' | 'file';
  filename?: string;
  fileType?: string;
  fileSize?: number;
  textLength: number;
  totalFindings: number;
  findingCategories: Record<string, number>;
  riskScore: number;
  riskLevel: SeverityLevel;
  classification: DocumentClassification;
  policyDecision: PolicyDecision;
  policyName: string;
  reasons: string[];
}

export interface DlpPolicyConfig {
  blockThreshold: number; // default 85
  warnThreshold: number;  // default 35
  blockOnCritical: boolean; // default true
  blockOnUnmaskedCards: boolean; // default true
  blockOnPrivateKeys: boolean; // default true
  enforceGovtPiiWarn: boolean; // default true
}
