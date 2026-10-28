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
  score: number;
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

export interface DlpPolicyConfig {
  blockThreshold: number;
  warnThreshold: number;
  blockOnCritical: boolean;
  blockOnUnmaskedCards: boolean;
  blockOnPrivateKeys: boolean;
  enforceGovtPiiWarn: boolean;
}

export declare const LABELS: Record<string, string>;

export declare function verhoeffValid(s: string): boolean;
export declare function luhnValid(s: string): boolean;
export declare function identifyCardBrand(digits: string): string;
export declare function generateMaskedDisplay(type: string, value: string): string;
export declare function normalizeIndicDigits(text: string): string;

export declare function scanPrompt(raw: string): Finding[];
export declare function calculateRisk(findings: Finding[]): RiskAnalysis;
export declare function evaluatePolicies(
  findings: Finding[],
  risk: RiskAnalysis,
  customConfig?: Partial<DlpPolicyConfig>
): PolicyEvaluation;
export declare function scanDocument(
  text: string,
  options?: {
    filename?: string;
    fileType?: string;
    fileSize?: number;
    customConfig?: Partial<DlpPolicyConfig>;
  }
): ScanResult;

export declare function extractMaxIndices(
  textOrArray: string | string[]
): Record<string, number>;
export declare function maskPrompt(
  raw: string,
  findings: Finding[],
  baseCounts?: Record<string, number>
): { masked: string; map: Record<string, string> };
export declare function restorePlaceholders(
  text: string,
  map: Record<string, string>
): string;
export declare function summarize(findings: Finding[]): SummaryItem[];
