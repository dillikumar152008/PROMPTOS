// Checksum algorithms and verification logic for PromptOS DLP

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

/**
 * Validates 12-digit Indian Aadhaar number using Verhoeff algorithm.
 */
export function verhoeffValid(s: string): boolean {
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

/**
 * Validates Credit / Debit card numbers using Luhn checksum algorithm.
 */
export function luhnValid(s: string): boolean {
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

export type CardBrand = 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'RuPay' | 'Diners Club' | 'JCB' | 'Payment Card';

/**
 * Identifies the card brand based on industry standard IIN/BIN ranges.
 */
export function identifyCardBrand(digits: string): CardBrand {
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

/**
 * Generates a safe masked preview of sensitive data for UI display.
 * Never returns the unmasked value.
 */
export function generateMaskedDisplay(type: string, value: string): string {
  if (!value) return '***';
  const val = value.trim();

  switch (type) {
    case 'AADHAAR': {
      const d = val.replace(/\D/g, '');
      if (d.length === 12) {
        return `XXXX-XXXX-${d.slice(-4)}`;
      }
      return `${val.slice(0, 2)}****${val.slice(-2)}`;
    }
    case 'PAN': {
      if (val.length === 10) {
        return `${val.slice(0, 2)}***${val.slice(-2)}`;
      }
      return `${val.slice(0, 1)}****${val.slice(-1)}`;
    }
    case 'CARD': {
      const d = val.replace(/\D/g, '');
      if (d.length >= 13) {
        return `${d.slice(0, 4)} **** **** ${d.slice(-4)}`;
      }
      return '**** **** **** ****';
    }
    case 'EMAIL': {
      const parts = val.split('@');
      if (parts.length === 2) {
        const [user, domain] = parts;
        const visibleUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
        return `${visibleUser}@${domain}`;
      }
      return '***@***.***';
    }
    case 'PHONE': {
      const digits = val.replace(/\D/g, '');
      if (digits.length >= 10) {
        return `+** **** ${digits.slice(-4)}`;
      }
      return '***-***-****';
    }
    case 'API_KEY':
    case 'PASSWORD':
    case 'PRIVATE_KEY': {
      if (val.length > 10) {
        return `${val.slice(0, 4)}...${val.slice(-4)}`;
      }
      return '********';
    }
    case 'BANK_ACCOUNT': {
      const d = val.replace(/\D/g, '');
      if (d.length >= 8) {
        return `****${d.slice(-4)}`;
      }
      return '******';
    }
    case 'IFSC': {
      if (val.length === 11) {
        return `${val.slice(0, 4)}0***${val.slice(-2)}`;
      }
      return '****0******';
    }
    case 'PASSPORT': {
      if (val.length >= 6) {
        return `${val.slice(0, 2)}****${val.slice(-2)}`;
      }
      return '******';
    }
    case 'IP_ADDRESS': {
      const parts = val.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.*.*`;
      }
      return '***.***.*.*';
    }
    default: {
      if (val.length <= 4) return '****';
      return `${val.slice(0, 2)}****${val.slice(-2)}`;
    }
  }
}
