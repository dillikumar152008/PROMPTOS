export interface Finding {
  type: 'AADHAAR' | 'PAN' | 'PHONE' | 'CARD' | 'EMAIL' | 'API_KEY';
  start: number;
  end: number;
  confidence: 'high' | 'medium';
  value: string;
  placeholder?: string;
}

export interface SummaryItem {
  type: string;
  label: string;
  count: number;
}

export declare const LABELS: Record<string, string>;

export declare function verhoeffValid(s: string): boolean;
export declare function luhnValid(s: string): boolean;
export declare function scanPrompt(raw: string): Finding[];
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
