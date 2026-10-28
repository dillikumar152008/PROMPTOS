// PromptOS Comprehensive DLP Patterns, Matchers & Context Analyzers

import { verhoeffValid, luhnValid, identifyCardBrand, generateMaskedDisplay } from './checksums';
import type { Finding, FindingType, SeverityLevel, ConfidenceLevel } from './types';

export const LABELS: Record<string, string> = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  PHONE: 'Phone',
  CARD: 'Credit / Debit Card',
  EMAIL: 'Email',
  API_KEY: 'API Key / Secret',
  PASSWORD: 'Password / Credential',
  PRIVATE_KEY: 'Cryptographic Private Key',
  BANK_ACCOUNT: 'Bank Account Number',
  IFSC: 'Indian Financial System Code (IFSC)',
  PASSPORT: 'Passport Number',
  IP_ADDRESS: 'IP Address',
  URL_CREDENTIAL: 'URL with Exposed Credentials',
  NAME: 'Personal Name (PII)',
  ADDRESS: 'Physical Address (PII)',
};

/**
 * Normalizes Devanagari (U+0966..) and Tamil (U+0BE6..) numerals to ASCII 0-9.
 * 1:1 mapping so string indices remain strictly aligned.
 */
export function normalizeIndicDigits(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u0966-\u096F]/g, (c) => String(c.charCodeAt(0) - 0x0966))
    .replace(/[\u0BE6-\u0BEF]/g, (c) => String(c.charCodeAt(0) - 0x0BE6));
}

/**
 * Robust regex match iterator compatible across all TypeScript compilation targets.
 */
export function getAllMatches(text: string, regex: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const rx = new RegExp(regex.source, flags);
  while ((m = rx.exec(text)) !== null) {
    matches.push(m);
  }
  return matches;
}

// Proximity context check helper
export function hasContextNear(
  fullText: string,
  start: number,
  end: number,
  regex: RegExp,
  lookbehindChars = 40,
  lookaheadChars = 20
): boolean {
  const before = fullText.slice(Math.max(0, start - lookbehindChars), start);
  const after = fullText.slice(end, Math.min(fullText.length, end + lookaheadChars));
  return regex.test(before) || regex.test(after);
}

// ── REGULAR EXPRESSIONS ─────────────────────────────────────────────────────

const AADHAAR_REGEX = /(?<!\d[ -]?)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g;
const AADHAAR_CONTEXT = /(?:aadhaar|aadhar|uidai|uid|adhaar|आधार|ஆதார்)/i;
const PAN_REGEX = /(?<![A-Z0-9])[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z](?![A-Z0-9])/gi;
const CARD_REGEX = /(?<!\d[ -]?)(?:\d[ -]?){12,18}\d(?![ -]?\d)/g;
const IFSC_REGEX = /(?<![A-Z0-9])[A-Z]{4}0[A-Z0-9]{6}(?![A-Z0-9])/gi;
const BANK_ACCOUNT_CANDIDATE = /(?<!\d)\d{9,18}(?!\d)/g;
const BANK_CONTEXT = /(?:account|a\/c|acct|bank\s*a\/c|savings\s*a\/c|current\s*a\/c|account\s*no|acc\s*no|acct\s*#|खाता|வங்கி\s*கணக்கு)/i;
const INDIAN_PASSPORT_REGEX = /(?<![A-Z0-9])[A-PR-WY-Z]\d{7}(?![A-Z0-9])/gi;
const PASSPORT_CONTEXT = /(?:passport|passport\s*no|passport\s*number|पासपोर्ट|கடவுச்சீட்டு)/i;
const PHONE_INDIA_REGEX = /(?<!\d[ -]?)(?:\+91[ -]?|91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?![ -]?\d)/g;
const PHONE_INTL_REGEX = /(?<!\w)\+(?:1[ -]?\d{3}[ -]?\d{3}[ -]?\d{4}|44[ -]?\d{4}[ -]?\d{6}|49[ -]?\d{3}[ -]?\d{7,8}|33[ -]?\d{1}[ -]?\d{2}[ -]?\d{2}[ -]?\d{2}[ -]?\d{2}|81[ -]?\d{2}[ -]?\d{4}[ -]?\d{4}|61[ -]?\d{1}[ -]?\d{4}[ -]?\d{4}|[2-9]\d{1,2}[ -]?\d{3,4}[ -]?\d{4,6})(?!\d)/g;
const PHONE_US_REGEX = /(?<!\d)(?:\(\d{3}\)|\d{3})[ -.]\d{3}[ -.]\d{4}(?!\d)/g;
const PHONE_CONTEXT = /(?:phone|mobile|tel|contact|call|cell|telephone|whatsapp|फोन|தொலைபேசி)/i;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
const IPV6_REGEX = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:[0-9a-fA-F]{1,4}\b|\b::1\b/g;
const URL_CREDENTIAL_REGEX = /https?:\/\/[^\s:@/]+:[^\s:@/]+@[^\s/$.?#].[^\s]*/gi;
const URL_SENSITIVE_PARAM_REGEX = /https?:\/\/[^\s]+\?(?:[^\s]*&)?(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|client[_-]?secret)=[^\s&]{8,}/gi;
const PRIVATE_KEY_REGEX = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g;

const API_KEY_PATTERNS = [
  { name: 'OpenAI API Key', regex: /\b(?:sk-proj-[A-Za-z0-9_-]{48,}|sk-[A-Za-z0-9_-]{32,})\b/g, severity: 'CRITICAL' as SeverityLevel },
  { name: 'Anthropic Claude API Key', regex: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/g, severity: 'CRITICAL' as SeverityLevel },
  { name: 'AWS Access Key ID', regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g, severity: 'CRITICAL' as SeverityLevel },
  { name: 'GitHub Personal Access Token', regex: /\b(?:ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,82})\b/g, severity: 'CRITICAL' as SeverityLevel },
  { name: 'Google API Key', regex: /\bAIzaSy[A-Za-z0-9_-]{33}\b/g, severity: 'CRITICAL' as SeverityLevel },
  { name: 'Stripe Secret / Restricted Key', regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g, severity: 'CRITICAL' as SeverityLevel },
  { name: 'Slack Bot / User Token', regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,32}\b/g, severity: 'CRITICAL' as SeverityLevel },
  { name: 'JSON Web Token (JWT)', regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, severity: 'HIGH' as SeverityLevel },
];

const CONTEXTUAL_PASSWORD_REGEX = /\b(?:password|passwd|pwd|db_pass|client_secret|auth_secret)\s*[:=]\s*['"]?([^\s'"]{6,64})['"]?/gi;
const CONTEXTUAL_NAME_REGEX = /\b(?:my name is|full name\s*[:=]|patient name\s*[:=]|customer name\s*[:=]|account holder\s*[:=]|holder name\s*[:=])\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi;
const CONTEXTUAL_ADDRESS_REGEX = /\b(?:residing at|permanent address|residential address|billing address|shipping address)\s*[:=]?\s+([0-9A-Za-z\s,.-]{15,90}(?:street|road|rd|lane|ln|nagar|colony|block|sector|city|state|pin|zip|avenue|ave|drive|dr))/gi;

/**
 * Scan raw input and detect all sensitive entities with contextual metadata.
 */
export function detectAllEntities(raw: string): Finding[] {
  if (!raw || typeof raw !== 'string') return [];

  const normalized = normalizeIndicDigits(raw);
  const findings: Finding[] = [];
  const usedRanges: [number, number][] = [];

  const isRangeFree = (s: number, e: number): boolean => {
    return !usedRanges.some(([us, ue]) => s < ue && e > us);
  };

  const recordFinding = (finding: Finding) => {
    usedRanges.push([finding.start, finding.end]);
    findings.push(finding);
  };

  // 1. Cryptographic Private Keys (CRITICAL)
  for (const m of getAllMatches(raw, PRIVATE_KEY_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      recordFinding({
        type: 'PRIVATE_KEY',
        label: LABELS.PRIVATE_KEY,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'CRITICAL',
        value: raw.slice(s, e),
        maskedValue: generateMaskedDisplay('PRIVATE_KEY', raw.slice(s, e)),
        detectionMethod: 'regex_pem_header',
        explanation: 'Full cryptographic private key block detected (RSA/OpenSSH/PGP). Critical exfiltration risk.',
      });
    }
  }

  // 2. High-Entropy API Keys & Tokens (CRITICAL/HIGH)
  for (const pattern of API_KEY_PATTERNS) {
    for (const m of getAllMatches(raw, pattern.regex)) {
      const s = m.index;
      const e = s + m[0].length;
      if (isRangeFree(s, e)) {
        const val = raw.slice(s, e);
        recordFinding({
          type: 'API_KEY',
          label: LABELS.API_KEY,
          start: s,
          end: e,
          confidence: 'high',
          severity: pattern.severity,
          value: val,
          maskedValue: generateMaskedDisplay('API_KEY', val),
          detectionMethod: 'high_entropy_token',
          explanation: `Detected valid ${pattern.name} pattern. High risk of unauthorized API access.`,
          metadata: { provider: pattern.name },
        });
      }
    }
  }

  // 3. Exposed Credentials in URLs (CRITICAL)
  for (const m of getAllMatches(raw, URL_CREDENTIAL_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'URL_CREDENTIAL',
        label: LABELS.URL_CREDENTIAL,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'CRITICAL',
        value: val,
        maskedValue: generateMaskedDisplay('URL_CREDENTIAL', val),
        detectionMethod: 'url_embedded_basic_auth',
        explanation: 'URL contains plaintext username:password credentials embedded in target authority.',
      });
    }
  }
  for (const m of getAllMatches(raw, URL_SENSITIVE_PARAM_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'URL_CREDENTIAL',
        label: LABELS.URL_CREDENTIAL,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'CRITICAL',
        value: val,
        maskedValue: generateMaskedDisplay('URL_CREDENTIAL', val),
        detectionMethod: 'url_sensitive_parameter',
        explanation: 'URL query parameter exposes secret token or API key in cleartext.',
      });
    }
  }

  // 4. Contextual Passwords & Database Credentials (CRITICAL)
  for (const m of getAllMatches(raw, CONTEXTUAL_PASSWORD_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'PASSWORD',
        label: LABELS.PASSWORD,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'CRITICAL',
        value: val,
        maskedValue: generateMaskedDisplay('PASSWORD', val),
        detectionMethod: 'contextual_assignment',
        explanation: 'Cleartext password or secret credential assignment detected.',
      });
    }
  }

  // 5. Payment Cards (CRITICAL/HIGH) - Checked with Luhn Algorithm & Brand Identification
  for (const m of getAllMatches(normalized, CARD_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    const digits = m[0].replace(/\D/g, '');
    if ((digits.length >= 13 && digits.length <= 19) && luhnValid(digits)) {
      if (digits.length === 13 && digits.startsWith('1')) continue;

      if (isRangeFree(s, e)) {
        const brand = identifyCardBrand(digits);
        const val = raw.slice(s, e);
        recordFinding({
          type: 'CARD',
          label: LABELS.CARD,
          start: s,
          end: e,
          confidence: 'high',
          severity: 'CRITICAL',
          value: val,
          maskedValue: generateMaskedDisplay('CARD', val),
          detectionMethod: `luhn_checksum_${brand.toLowerCase().replace(/\s+/g, '_')}`,
          explanation: `Valid Luhn checksum confirmed for ${brand} payment card.`,
          metadata: { cardBrand: brand },
        });
      }
    }
  }

  // 6. Aadhaar Numbers (HIGH/MEDIUM) - Verhoeff Checksum + Keyword Proximity
  for (const m of getAllMatches(normalized, AADHAAR_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (!isRangeFree(s, e)) continue;

    const digits = m[0].replace(/\D/g, '');
    const isChecksumValid = verhoeffValid(digits);
    const hasContext = hasContextNear(normalized, s, e, AADHAAR_CONTEXT);

    if (isChecksumValid) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'AADHAAR',
        label: LABELS.AADHAAR,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'HIGH',
        value: val,
        maskedValue: generateMaskedDisplay('AADHAAR', val),
        detectionMethod: 'verhoeff_checksum_algorithm',
        explanation: 'Valid 12-digit Indian Aadhaar number verified with Verhoeff mathematical checksum.',
      });
    } else if (hasContext) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'AADHAAR',
        label: LABELS.AADHAAR,
        start: s,
        end: e,
        confidence: 'medium',
        severity: 'HIGH',
        value: val,
        maskedValue: generateMaskedDisplay('AADHAAR', val),
        detectionMethod: 'contextual_proximity',
        explanation: '12-digit number located beside Aadhaar keyword (possible mistyped checksum).',
      });
    }
  }

  // 7. PAN Numbers (HIGH)
  for (const m of getAllMatches(normalized, PAN_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'PAN',
        label: LABELS.PAN,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'HIGH',
        value: val,
        maskedValue: generateMaskedDisplay('PAN', val),
        detectionMethod: 'regex_structure_and_entity',
        explanation: 'Valid Indian Permanent Account Number (PAN) identifier.',
      });
    }
  }

  // 8. Indian Financial System Code (IFSC) (HIGH)
  for (const m of getAllMatches(normalized, IFSC_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'IFSC',
        label: LABELS.IFSC,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'HIGH',
        value: val,
        maskedValue: generateMaskedDisplay('IFSC', val),
        detectionMethod: 'rbi_ifsc_structure',
        explanation: `Indian Financial System Code (IFSC) for ${val.slice(0, 4)} bank branch.`,
        metadata: { bankCode: val.slice(0, 4) },
      });
    }
  }

  // 9. Bank Account Numbers (HIGH) - Context Gated
  for (const m of getAllMatches(normalized, BANK_ACCOUNT_CANDIDATE)) {
    const s = m.index;
    const e = s + m[0].length;
    if (!isRangeFree(s, e)) continue;
    if (m[0].length === 12 && verhoeffValid(m[0])) continue;

    const hasContext = hasContextNear(normalized, s, e, BANK_CONTEXT, 35, 20);
    if (hasContext) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'BANK_ACCOUNT',
        label: LABELS.BANK_ACCOUNT,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'HIGH',
        value: val,
        maskedValue: generateMaskedDisplay('BANK_ACCOUNT', val),
        detectionMethod: 'contextual_bank_identifier',
        explanation: 'Bank account number identified adjacent to banking keywords.',
      });
    }
  }

  // 10. Passport Numbers (HIGH) - Context Gated
  for (const m of getAllMatches(normalized, INDIAN_PASSPORT_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (!isRangeFree(s, e)) continue;

    const hasContext = hasContextNear(normalized, s, e, PASSPORT_CONTEXT, 40, 20);
    if (hasContext) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'PASSPORT',
        label: LABELS.PASSPORT,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'HIGH',
        value: val,
        maskedValue: generateMaskedDisplay('PASSPORT', val),
        detectionMethod: 'contextual_passport_regex',
        explanation: 'Passport identifier detected with proximity context.',
      });
    }
  }

  // 11. Email Addresses (MEDIUM/LOW)
  for (const m of getAllMatches(raw, EMAIL_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      const isPrivileged = /^(admin|root|security|billing|hr|legal|finance)@/i.test(val);
      recordFinding({
        type: 'EMAIL',
        label: LABELS.EMAIL,
        start: s,
        end: e,
        confidence: 'high',
        severity: isPrivileged ? 'HIGH' : 'MEDIUM',
        value: val,
        maskedValue: generateMaskedDisplay('EMAIL', val),
        detectionMethod: 'rfc5322_email_regex',
        explanation: isPrivileged ? 'High-privilege organizational email address.' : 'Valid email address detected.',
      });
    }
  }

  // 12. Phone Numbers (MEDIUM)
  for (const m of getAllMatches(normalized, PHONE_INDIA_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      const hasPrefix = /^(\+91|91|0)/.test(m[0].trim());
      const hasContext = hasContextNear(normalized, s, e, PHONE_CONTEXT);
      recordFinding({
        type: 'PHONE',
        label: LABELS.PHONE,
        start: s,
        end: e,
        confidence: (hasPrefix || hasContext) ? 'high' : 'medium',
        severity: 'MEDIUM',
        value: val,
        maskedValue: generateMaskedDisplay('PHONE', val),
        detectionMethod: 'indian_telecom_pattern',
        explanation: 'Indian mobile phone number detected.',
      });
    }
  }
  for (const m of getAllMatches(normalized, PHONE_INTL_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'PHONE',
        label: LABELS.PHONE,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'MEDIUM',
        value: val,
        maskedValue: generateMaskedDisplay('PHONE', val),
        detectionMethod: 'e164_international_phone',
        explanation: 'International phone number with country dialing prefix.',
      });
    }
  }
  for (const m of getAllMatches(normalized, PHONE_US_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const hasContext = hasContextNear(normalized, s, e, PHONE_CONTEXT);
      const val = raw.slice(s, e);
      recordFinding({
        type: 'PHONE',
        label: LABELS.PHONE,
        start: s,
        end: e,
        confidence: hasContext ? 'high' : 'medium',
        severity: 'MEDIUM',
        value: val,
        maskedValue: generateMaskedDisplay('PHONE', val),
        detectionMethod: 'nanp_phone_format',
        explanation: 'North American numbering plan (NANP) phone number.',
      });
    }
  }

  // 13. IP Addresses (LOW/MEDIUM)
  for (const m of getAllMatches(raw, IPV4_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      const isPrivate = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.0\.0\.1)/.test(val);
      recordFinding({
        type: 'IP_ADDRESS',
        label: LABELS.IP_ADDRESS,
        start: s,
        end: e,
        confidence: 'high',
        severity: isPrivate ? 'MEDIUM' : 'LOW',
        value: val,
        maskedValue: generateMaskedDisplay('IP_ADDRESS', val),
        detectionMethod: 'ipv4_octet_validation',
        explanation: isPrivate ? 'Internal private network IP address (RFC 1918).' : 'Public IPv4 network address.',
        metadata: { isPrivate },
      });
    }
  }
  for (const m of getAllMatches(raw, IPV6_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'IP_ADDRESS',
        label: LABELS.IP_ADDRESS,
        start: s,
        end: e,
        confidence: 'high',
        severity: 'LOW',
        value: val,
        maskedValue: generateMaskedDisplay('IP_ADDRESS', val),
        detectionMethod: 'ipv6_hex_colons',
        explanation: 'IPv6 network address.',
      });
    }
  }

  // 14. Contextual Personal Names (LOW/MEDIUM)
  for (const m of getAllMatches(raw, CONTEXTUAL_NAME_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'NAME',
        label: LABELS.NAME,
        start: s,
        end: e,
        confidence: 'medium',
        severity: 'LOW',
        value: val,
        maskedValue: generateMaskedDisplay('NAME', val),
        detectionMethod: 'contextual_name_prefix',
        explanation: 'Personally identifiable individual name with explicit context label.',
      });
    }
  }

  // 15. Contextual Physical Addresses (LOW/MEDIUM)
  for (const m of getAllMatches(raw, CONTEXTUAL_ADDRESS_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (isRangeFree(s, e)) {
      const val = raw.slice(s, e);
      recordFinding({
        type: 'ADDRESS',
        label: LABELS.ADDRESS,
        start: s,
        end: e,
        confidence: 'medium',
        severity: 'LOW',
        value: val,
        maskedValue: generateMaskedDisplay('ADDRESS', val),
        detectionMethod: 'contextual_address_prefix',
        explanation: 'Physical residential/mailing address containing street or city indicators.',
      });
    }
  }

  return findings.sort((a, b) => a.start - b.start);
}
