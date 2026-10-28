import { NextResponse } from 'next/server';
import { DEFAULT_POLICY_CONFIG } from '@/src/lib/dlp/policy-engine';
import type { DlpPolicyConfig } from '@/src/lib/dlp/types';

// In-memory policy state for configurable governance
let currentPolicyConfig: DlpPolicyConfig = { ...DEFAULT_POLICY_CONFIG };

export async function GET() {
  return NextResponse.json({
    policies: [
      {
        id: 'POL-01-KEY-EXFILTRATION',
        name: 'Cryptographic Key Exfiltration Protection',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'Immediately blocks any input containing RSA, OpenSSH, EC, or PGP private key blocks.',
        enabled: currentPolicyConfig.blockOnPrivateKeys,
      },
      {
        id: 'POL-02-PASSWORD-SECURITY',
        name: 'Cleartext Credential Protection Policy',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'Blocks cleartext password assignments and database authorization strings.',
        enabled: currentPolicyConfig.blockOnCritical,
      },
      {
        id: 'POL-03-API-KEY-LEAK',
        name: 'API Secret & Cloud Token Protection',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'Blocks high-entropy keys for OpenAI, Anthropic, AWS, GitHub, Google, Stripe, and Slack.',
        enabled: currentPolicyConfig.blockOnCritical,
      },
      {
        id: 'POL-04-PCI-DSS-CARDS',
        name: 'PCI-DSS Payment Card Data Protection',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'Blocks unmasked Visa, Mastercard, RuPay, Amex, and Discover payment card numbers.',
        enabled: currentPolicyConfig.blockOnUnmaskedCards,
      },
      {
        id: 'POL-05-GOVT-PII',
        name: 'National Identity PII Protection',
        severity: 'HIGH',
        action: 'WARN / REQUIRE MASKING',
        description: 'Flags Indian Aadhaar, PAN, and Passports. Requires privacy masking before transmission.',
        enabled: currentPolicyConfig.enforceGovtPiiWarn,
      },
      {
        id: 'POL-06-BANKING-DATA',
        name: 'Banking & Financial Data Security',
        severity: 'HIGH',
        action: 'WARN',
        description: 'Monitors Indian Bank Accounts and IFSC codes to protect customer financial assets.',
        enabled: true,
      },
    ],
    config: currentPolicyConfig,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    currentPolicyConfig = {
      ...currentPolicyConfig,
      ...body,
    };
    return NextResponse.json({ success: true, config: currentPolicyConfig });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update policy config' }, { status: 400 });
  }
}
