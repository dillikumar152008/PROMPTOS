// PromptOS Comprehensive DLP Engine (ES Module, runs in Browser, Node, and Next.js)
// Supports structured identifiers, checksum algorithms, high-entropy tokens, contextual analysis,
// risk scoring (0-100), document classification, and allow/warn/block policy evaluation.

// Verhoeff multiplication (d) and permutation (p) tables for Aadhaar checksum validation
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(s) {
  if (!s || typeof s !== 'string') return false;
  const clean = s.replace(/\D/g, '');
  if (clean.length !== 12) return false;
  let c = 0;
  const a = clean.split('').reverse();
  for (let i = 0; i < a.length; i++) {
    const digit = +a[i];
    if (isNaN(digit)) return false;
    c = D[c][P[i % 8][digit]];
  }
  return c === 0;
}

export function luhnValid(s) {
  if (!s || typeof s !== 'string') return false;
  const clean = s.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = +clean[i];
    if (isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function identifyCardBrand(digits) {
  const d = digits.replace(/\D/g, '');
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'American Express';
  if (/^(6011|65|64[4-9]|622)/.test(d)) return 'Discover';
  if (/^(60|65|81|82|508)/.test(d) && (d.length === 16 || d.length === 19)) return 'RuPay';
  if (/^3(?:0[0-5]|[68])/.test(d)) return 'Diners Club';
  if (/^35(?:2[89]|[3-8][0-9])/.test(d)) return 'JCB';
  return 'Payment Card';
}

export function generateMaskedDisplay(type, value) {
  if (!value) return '***';
  const val = value.trim();
  switch (type) {
    case 'AADHAAR': {
      const d = val.replace(/\D/g, '');
      return d.length === 12 ? `XXXX-XXXX-${d.slice(-4)}` : `${val.slice(0, 2)}****${val.slice(-2)}`;
    }
    case 'PAN':
      return val.length === 10 ? `${val.slice(0, 2)}***${val.slice(-2)}` : `${val.slice(0, 1)}****${val.slice(-1)}`;
    case 'CARD': {
      const d = val.replace(/\D/g, '');
      return d.length >= 13 ? `${d.slice(0, 4)} **** **** ${d.slice(-4)}` : '**** **** **** ****';
    }
    case 'EMAIL': {
      const parts = val.split('@');
      if (parts.length === 2) {
        const [u, dom] = parts;
        return `${u.length > 2 ? `${u[0]}***${u[u.length - 1]}` : `${u[0]}***`}@${dom}`;
      }
      return '***@***.***';
    }
    case 'PHONE': {
      const d = val.replace(/\D/g, '');
      return d.length >= 10 ? `+** **** ${d.slice(-4)}` : '***-***-****';
    }
    case 'API_KEY':
    case 'PASSWORD':
    case 'PRIVATE_KEY':
      return val.length > 10 ? `${val.slice(0, 4)}...${val.slice(-4)}` : '********';
    case 'BANK_ACCOUNT': {
      const d = val.replace(/\D/g, '');
      return d.length >= 8 ? `****${d.slice(-4)}` : '******';
    }
    case 'IFSC':
      return val.length === 11 ? `${val.slice(0, 4)}0***${val.slice(-2)}` : '****0******';
    case 'PASSPORT':
      return val.length >= 6 ? `${val.slice(0, 2)}****${val.slice(-2)}` : '******';
    case 'IP_ADDRESS': {
      const parts = val.split('.');
      return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : '***.***.*.*';
    }
    default:
      return val.length <= 4 ? '****' : `${val.slice(0, 2)}****${val.slice(-2)}`;
  }
}

// Indic numeral normalization (Tamil U+0BE6.. and Devanagari U+0966.. to ASCII)
export const normalizeIndicDigits = (t) =>
  (t || '')
    .replace(/[\u0966-\u096F]/g, (c) => String(c.charCodeAt(0) - 0x0966))
    .replace(/[\u0BE6-\u0BEF]/g, (c) => String(c.charCodeAt(0) - 0x0BE6));

const norm = normalizeIndicDigits;

const hasContextNear = (fullText, start, end, regex, lookbehind = 40, lookahead = 20) => {
  const before = fullText.slice(Math.max(0, start - lookbehind), start);
  const after = fullText.slice(end, Math.min(fullText.length, end + lookahead));
  return regex.test(before) || regex.test(after);
};

export const LABELS = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  PHONE: 'Phone',
  CARD: 'Card',
  EMAIL: 'Email',
  API_KEY: 'API key',
  PASSWORD: 'Password',
  PRIVATE_KEY: 'Private Key',
  BANK_ACCOUNT: 'Bank Account',
  IFSC: 'IFSC Code',
  PASSPORT: 'Passport',
  IP_ADDRESS: 'IP Address',
  URL_CREDENTIAL: 'URL Credential',
  NAME: 'Name',
  ADDRESS: 'Address',
};

// Patterns
const AADHAAR_KW = /(?:aadhaar|aadhar|uidai|uid|adhaar|आधार|ஆதார்)/i;
const CARD_REGEX = /(?<!\d[ -]?)(?:\d[ -]?){12,18}\d(?![ -]?\d)/g;
const AADHAAR_REGEX = /(?<!\d[ -]?)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g;
const PAN_REGEX = /(?<![A-Z0-9])[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z](?![A-Z0-9])/gi;
const IFSC_REGEX = /(?<![A-Z0-9])[A-Z]{4}0[A-Z0-9]{6}(?![A-Z0-9])/gi;
const BANK_ACCOUNT_REGEX = /(?<!\d)\d{9,18}(?!\d)/g;
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
  { name: 'OpenAI API Key', regex: /\b(?:sk-proj-[A-Za-z0-9_-]{48,}|sk-[A-Za-z0-9_-]{16,})\b/g, severity: 'CRITICAL' },
  { name: 'Anthropic Claude API Key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, severity: 'CRITICAL' },
  { name: 'AWS Access Key ID', regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g, severity: 'CRITICAL' },
  { name: 'GitHub Personal Access Token', regex: /\b(?:ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|ghu_[A-Za-z0-9]{30,}|ghs_[A-Za-z0-9]{30,}|ghr_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,82})\b/g, severity: 'CRITICAL' },
  { name: 'Google API Key', regex: /\bAIzaSy[A-Za-z0-9_-]{33}\b/g, severity: 'CRITICAL' },
  { name: 'Stripe Secret Key', regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g, severity: 'CRITICAL' },
  { name: 'Slack Token', regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,32}\b/g, severity: 'CRITICAL' },
  { name: 'JSON Web Token (JWT)', regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, severity: 'HIGH' },
];

const CONTEXTUAL_PASSWORD_REGEX = /\b(?:password|passwd|pwd|db_pass|client_secret|auth_secret)\s*[:=]\s*['"]?([^\s'"]{6,64})['"]?/gi;
const CONTEXTUAL_NAME_REGEX = /\b(?:my name is|full name\s*[:=]|patient name\s*[:=]|customer name\s*[:=]|account holder\s*[:=]|holder name\s*[:=])\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi;
const CONTEXTUAL_ADDRESS_REGEX = /\b(?:residing at|permanent address|residential address|billing address|shipping address)\s*[:=]?\s+([0-9A-Za-z\s,.-]{15,90}(?:street|road|rd|lane|ln|nagar|colony|block|sector|city|state|pin|zip|avenue|ave|drive|dr))/gi;

export function scanPrompt(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const t = norm(raw);
  const out = [];
  const used = [];

  const free = (s, e) => !used.some((u) => s < u[1] && e > u[0]);
  const add = (type, s, e, confidence, options = {}) => {
    used.push([s, e]);
    const val = raw.slice(s, e);
    out.push({
      type,
      start: s,
      end: e,
      confidence,
      value: val,
      maskedValue: generateMaskedDisplay(type, val),
      label: LABELS[type] || type,
      severity: options.severity || 'MEDIUM',
      detectionMethod: options.detectionMethod || 'pattern',
      explanation: options.explanation || `Detected ${LABELS[type] || type}.`,
      metadata: options.metadata || {},
    });
  };

  // 1. Private keys (CRITICAL)
  for (const m of raw.matchAll(PRIVATE_KEY_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('PRIVATE_KEY', s, e, 'high', {
        severity: 'CRITICAL',
        detectionMethod: 'regex_pem_header',
        explanation: 'Full cryptographic private key block detected. Critical secret exfiltration risk.',
      });
    }
  }

  // 2. High-Entropy API keys & tokens (CRITICAL/HIGH)
  for (const pattern of API_KEY_PATTERNS) {
    for (const m of raw.matchAll(pattern.regex)) {
      const s = m.index;
      const e = s + m[0].length;
      if (free(s, e)) {
        add('API_KEY', s, e, 'high', {
          severity: pattern.severity,
          detectionMethod: 'high_entropy_token',
          explanation: `Detected valid ${pattern.name} pattern. High risk of unauthorized API access.`,
          metadata: { provider: pattern.name },
        });
      }
    }
  }

  // 3. Exposed credentials in URLs (CRITICAL)
  for (const m of raw.matchAll(URL_CREDENTIAL_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('URL_CREDENTIAL', s, e, 'high', {
        severity: 'CRITICAL',
        detectionMethod: 'url_embedded_basic_auth',
        explanation: 'URL contains cleartext username:password credentials embedded in authority.',
      });
    }
  }
  for (const m of raw.matchAll(URL_SENSITIVE_PARAM_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('URL_CREDENTIAL', s, e, 'high', {
        severity: 'CRITICAL',
        detectionMethod: 'url_sensitive_parameter',
        explanation: 'URL query parameter exposes secret token or API key in cleartext.',
      });
    }
  }

  // 4. Contextual Passwords & Secrets (CRITICAL)
  for (const m of raw.matchAll(CONTEXTUAL_PASSWORD_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('PASSWORD', s, e, 'high', {
        severity: 'CRITICAL',
        detectionMethod: 'contextual_assignment',
        explanation: 'Cleartext password or secret credential assignment detected.',
      });
    }
  }

  // 5. Payment Cards with Luhn Checksum + Card Brand
  for (const m of t.matchAll(CARD_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    const d = m[0].replace(/\D/g, '');
    if ((d.length === 15 || d.length === 16 || d.length === 19 || d.length === 14) && luhnValid(d)) {
      if (d.length === 13 && d.startsWith('1')) continue; // skip 13-digit timestamps
      if (free(s, e)) {
        const brand = identifyCardBrand(d);
        add('CARD', s, e, 'high', {
          severity: 'CRITICAL',
          detectionMethod: `luhn_checksum_${brand.toLowerCase().replace(/\s+/g, '_')}`,
          explanation: `Valid Luhn checksum confirmed for ${brand} payment card.`,
          metadata: { cardBrand: brand },
        });
      }
    }
  }

  // 6. Aadhaar (Verhoeff checksum + Keyword proximity)
  for (const m of t.matchAll(AADHAAR_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (!free(s, e)) continue;
    const d = m[0].replace(/\D/g, '');
    if (verhoeffValid(d)) {
      add('AADHAAR', s, e, 'high', {
        severity: 'HIGH',
        detectionMethod: 'verhoeff_checksum_algorithm',
        explanation: 'Valid 12-digit Indian Aadhaar number verified with Verhoeff mathematical checksum.',
      });
    } else if (hasContextNear(t, s, e, AADHAAR_KW, 35, 15)) {
      add('AADHAAR', s, e, 'medium', {
        severity: 'HIGH',
        detectionMethod: 'contextual_proximity',
        explanation: '12-digit number located beside Aadhaar keyword (possible mistyped checksum).',
      });
    }
  }

  // 7. PAN Numbers
  for (const m of t.matchAll(PAN_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('PAN', s, e, 'high', {
        severity: 'HIGH',
        detectionMethod: 'regex_structure_and_entity',
        explanation: 'Valid Indian Permanent Account Number (PAN) identifier.',
      });
    }
  }

  // 8. IFSC Codes
  for (const m of t.matchAll(IFSC_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      const val = raw.slice(s, e);
      add('IFSC', s, e, 'high', {
        severity: 'HIGH',
        detectionMethod: 'rbi_ifsc_structure',
        explanation: `Indian Financial System Code (IFSC) for ${val.slice(0, 4)} branch.`,
        metadata: { bankCode: val.slice(0, 4) },
      });
    }
  }

  // 9. Bank Account Numbers (Context Gated)
  for (const m of t.matchAll(BANK_ACCOUNT_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (!free(s, e)) continue;
    if (m[0].length === 12 && verhoeffValid(m[0])) continue;
    if (hasContextNear(t, s, e, BANK_CONTEXT, 35, 20)) {
      add('BANK_ACCOUNT', s, e, 'high', {
        severity: 'HIGH',
        detectionMethod: 'contextual_bank_identifier',
        explanation: 'Bank account number identified adjacent to banking keywords.',
      });
    }
  }

  // 10. Passports (Context Gated)
  for (const m of t.matchAll(INDIAN_PASSPORT_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (!free(s, e)) continue;
    if (hasContextNear(t, s, e, PASSPORT_CONTEXT, 40, 20)) {
      add('PASSPORT', s, e, 'high', {
        severity: 'HIGH',
        detectionMethod: 'contextual_passport_regex',
        explanation: 'Passport identifier detected with proximity context.',
      });
    }
  }

  // 11. Email addresses
  for (const m of raw.matchAll(EMAIL_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      const val = raw.slice(s, e);
      const isPrivileged = /^(admin|root|security|billing|hr|legal|finance)@/i.test(val);
      add('EMAIL', s, e, 'high', {
        severity: isPrivileged ? 'HIGH' : 'MEDIUM',
        detectionMethod: 'rfc5322_email_regex',
        explanation: isPrivileged ? 'High-privilege organizational email address.' : 'Valid email address detected.',
      });
    }
  }

  // 12. Phone numbers (Indian, International E.164, US/NANP)
  for (const m of t.matchAll(PHONE_INDIA_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      const hasPrefix = /^(\+91|91|0)/.test(m[0].trim());
      const hasContext = hasContextNear(t, s, e, PHONE_CONTEXT);
      add('PHONE', s, e, (hasPrefix || hasContext) ? 'high' : 'medium', {
        severity: 'MEDIUM',
        detectionMethod: 'indian_telecom_pattern',
        explanation: 'Indian mobile phone number detected.',
      });
    }
  }
  for (const m of t.matchAll(PHONE_INTL_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('PHONE', s, e, 'high', {
        severity: 'MEDIUM',
        detectionMethod: 'e164_international_phone',
        explanation: 'International phone number with country dialing prefix.',
      });
    }
  }
  for (const m of t.matchAll(PHONE_US_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      const hasContext = hasContextNear(t, s, e, PHONE_CONTEXT);
      add('PHONE', s, e, hasContext ? 'high' : 'medium', {
        severity: 'MEDIUM',
        detectionMethod: 'nanp_phone_format',
        explanation: 'North American numbering plan (NANP) phone number.',
      });
    }
  }

  // 13. IP addresses (IPv4 & IPv6)
  for (const m of raw.matchAll(IPV4_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      const val = raw.slice(s, e);
      const isPrivate = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.0\.0\.1)/.test(val);
      add('IP_ADDRESS', s, e, 'high', {
        severity: isPrivate ? 'MEDIUM' : 'LOW',
        detectionMethod: 'ipv4_octet_validation',
        explanation: isPrivate ? 'Internal private network IP address (RFC 1918).' : 'Public IPv4 network address.',
        metadata: { isPrivate },
      });
    }
  }
  for (const m of raw.matchAll(IPV6_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('IP_ADDRESS', s, e, 'high', {
        severity: 'LOW',
        detectionMethod: 'ipv6_hex_colons',
        explanation: 'IPv6 network address.',
      });
    }
  }

  // 14. Contextual Names
  for (const m of raw.matchAll(CONTEXTUAL_NAME_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('NAME', s, e, 'medium', {
        severity: 'LOW',
        detectionMethod: 'contextual_name_prefix',
        explanation: 'Personally identifiable individual name with explicit context label.',
      });
    }
  }

  // 15. Contextual Addresses
  for (const m of raw.matchAll(CONTEXTUAL_ADDRESS_REGEX)) {
    const s = m.index;
    const e = s + m[0].length;
    if (free(s, e)) {
      add('ADDRESS', s, e, 'medium', {
        severity: 'LOW',
        detectionMethod: 'contextual_address_prefix',
        explanation: 'Physical residential/mailing address containing street or city indicators.',
      });
    }
  }

  return out.sort((a, b) => a.start - b.start);
}

export function calculateRisk(findings) {
  if (!findings || findings.length === 0) {
    return {
      score: 0,
      level: 'LOW',
      classification: 'PUBLIC',
      breakdown: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
      explanation: 'No sensitive data detected. Clean content.',
    };
  }

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let rawScore = 0;

  const weights = { CRITICAL: 35, HIGH: 20, MEDIUM: 10, LOW: 4 };
  const mults = { high: 1.0, medium: 0.75, low: 0.5 };

  for (const f of findings) {
    const sev = f.severity || 'MEDIUM';
    const conf = f.confidence || 'high';
    rawScore += (weights[sev] || 10) * (mults[conf] || 1.0);
    if (sev === 'CRITICAL') criticalCount++;
    else if (sev === 'HIGH') highCount++;
    else if (sev === 'MEDIUM') mediumCount++;
    else lowCount++;
  }

  let score = Math.round(rawScore);
  if (criticalCount > 0) score = Math.max(score, 85);
  else if (highCount > 0) score = Math.max(score, 60);
  else if (mediumCount > 0) score = Math.max(score, 30);
  score = Math.min(100, score);

  let level = 'LOW';
  if (score >= 85) level = 'CRITICAL';
  else if (score >= 60) level = 'HIGH';
  else if (score >= 30) level = 'MEDIUM';

  let classification = 'PUBLIC';
  if (criticalCount > 0 || score >= 75) classification = 'RESTRICTED';
  else if (highCount > 0 || mediumCount >= 3 || score >= 45) classification = 'CONFIDENTIAL';
  else if (mediumCount > 0 || lowCount > 0 || score >= 15) classification = 'INTERNAL';

  return {
    score,
    level,
    classification,
    breakdown: { criticalCount, highCount, mediumCount, lowCount },
    explanation: `Document scored ${score}/100 (${level} Risk, Classified ${classification}).`,
  };
}

export function evaluatePolicies(findings, risk, customConfig = {}) {
  const config = {
    blockThreshold: 85,
    warnThreshold: 35,
    blockOnCritical: true,
    blockOnUnmaskedCards: true,
    blockOnPrivateKeys: true,
    enforceGovtPiiWarn: true,
    ...customConfig,
  };

  const violations = [];
  const reasons = [];

  const privateKeys = findings.filter((f) => f.type === 'PRIVATE_KEY');
  if (config.blockOnPrivateKeys && privateKeys.length > 0) {
    violations.push({ policyId: 'POL-01', policyName: 'Cryptographic Key Exfiltration Protection', severity: 'CRITICAL', reason: 'Cryptographic private key detected.' });
    reasons.push('Prohibited cryptographic private keys detected.');
  }

  const passwords = findings.filter((f) => f.type === 'PASSWORD' || f.type === 'URL_CREDENTIAL');
  if (config.blockOnCritical && passwords.length > 0) {
    violations.push({ policyId: 'POL-02', policyName: 'Cleartext Credential Protection Policy', severity: 'CRITICAL', reason: 'Cleartext passwords or URL credentials detected.' });
    reasons.push('Prohibited cleartext credentials detected.');
  }

  const apiKeys = findings.filter((f) => f.type === 'API_KEY');
  if (config.blockOnCritical && apiKeys.length > 0) {
    violations.push({ policyId: 'POL-03', policyName: 'API Secret & Cloud Token Protection', severity: 'CRITICAL', reason: 'High-entropy API keys detected.' });
    reasons.push('High-entropy API keys detected.');
  }

  const cards = findings.filter((f) => f.type === 'CARD');
  if (config.blockOnUnmaskedCards && cards.length > 0) {
    violations.push({ policyId: 'POL-04', policyName: 'PCI-DSS Payment Card Data Protection', severity: 'CRITICAL', reason: 'Payment card numbers detected.' });
    reasons.push('Payment card numbers detected.');
  }

  const govtPii = findings.filter((f) => f.type === 'AADHAAR' || f.type === 'PAN' || f.type === 'PASSPORT');
  if (config.enforceGovtPiiWarn && govtPii.length > 0) {
    violations.push({ policyId: 'POL-05', policyName: 'National Identity PII Protection', severity: 'HIGH', reason: 'National identity identifiers detected.' });
    reasons.push('National identity identifiers detected.');
  }

  const bankData = findings.filter((f) => f.type === 'BANK_ACCOUNT' || f.type === 'IFSC');
  if (bankData.length > 0) {
    violations.push({ policyId: 'POL-06', policyName: 'Banking & Financial Data Security', severity: 'HIGH', reason: 'Bank account or IFSC records detected.' });
    reasons.push('Bank account or IFSC numbers detected.');
  }

  let decision = 'ALLOW';
  let policyName = 'Standard Clean Content Policy';
  let recommendedAction = 'No policy violations found. Content is safe for processing.';

  const hasCritical = violations.some((v) => v.severity === 'CRITICAL');
  const hasHigh = violations.some((v) => v.severity === 'HIGH');
  const hasMedium = violations.some((v) => v.severity === 'MEDIUM');

  if (hasCritical || risk.score >= config.blockThreshold) {
    decision = 'BLOCK';
    policyName = 'Zero-Trust Data Protection Policy (Enforced Block)';
    recommendedAction = 'Operation prohibited: Remove private keys, passwords, payment cards, or secrets before processing.';
  } else if (hasHigh || hasMedium || risk.score >= config.warnThreshold) {
    decision = 'WARN';
    policyName = 'Confidential Data Handling Policy (Review / Masking Required)';
    recommendedAction = 'Sensitive data detected: Enable DLP Shield masking to replace personal identifiers with privacy-preserving tokens before sending.';
  }

  return {
    decision,
    policyName,
    reasons: reasons.length > 0 ? reasons : ['No sensitive patterns identified.'],
    recommendedAction,
    violations,
  };
}

export function scanDocument(text, options = {}) {
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();
  const findings = scanPrompt(text || '');
  const summary = summarize(findings);
  const risk = calculateRisk(findings);
  const policy = evaluatePolicies(findings, risk, options.customConfig);

  return {
    scanId,
    timestamp,
    sourceType: options.filename ? 'file' : 'text',
    filename: options.filename,
    fileType: options.fileType || (options.filename ? options.filename.split('.').pop() : 'text'),
    fileSize: options.fileSize,
    textLength: (text || '').length,
    findings,
    summary,
    risk,
    policy,
  };
}

export function extractMaxIndices(textOrArray) {
  const counts = {};
  const texts = Array.isArray(textOrArray) ? textOrArray : [textOrArray || ''];
  const regex = /\[([A-Z_]+)_(\d+)\]/g;
  for (const t of texts) {
    if (!t || typeof t !== 'string') continue;
    for (const m of t.matchAll(regex)) {
      const type = m[1];
      const num = parseInt(m[2], 10);
      if (!isNaN(num)) {
        counts[type] = Math.max(counts[type] || 0, num);
      }
    }
  }
  return counts;
}

export function maskPrompt(raw, findings, baseCounts = {}) {
  if (!raw) return { masked: '', map: {} };
  if (!findings || findings.length === 0) return { masked: raw, map: {} };

  const counts = { ...baseCounts };
  const items = findings.map((f) => {
    counts[f.type] = (counts[f.type] || 0) + 1;
    return { ...f, placeholder: `[${f.type}_${counts[f.type]}]` };
  });

  let masked = raw;
  for (const it of [...items].reverse()) {
    masked = masked.slice(0, it.start) + it.placeholder + masked.slice(it.end);
  }

  const map = {};
  items.forEach((it) => {
    map[it.placeholder] = it.value;
  });

  return { masked, map };
}

export function restorePlaceholders(text, map) {
  if (!text) return '';
  if (!map || Object.keys(map).length === 0) return text;
  let out = text;
  for (const [ph, val] of Object.entries(map)) {
    out = out.split(ph).join(val);
  }
  return out;
}

export function summarize(findings) {
  if (!findings || findings.length === 0) return [];
  const c = {};
  findings.forEach((f) => {
    c[f.type] = (c[f.type] || 0) + 1;
  });
  return Object.entries(c).map(([type, count]) => ({
    type,
    label: LABELS[type] || type,
    count,
  }));
}
