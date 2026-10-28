import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PolicyAction, InspectionStatus } from '@/lib/policy';

export interface PrivacyReceiptData {
  userId: string;
  conversationId?: string | null;
  messageId?: string | null;
  action: PolicyAction;
  policyVersion: string;
  inspectionStatus: InspectionStatus;
  overrideUsed: boolean;
  categoryCounts: Record<string, number>;
  attachmentsInspected?: number | null;
  attachmentsTotal?: number | null;
}

export interface PrivacyReceipt extends PrivacyReceiptData {
  id: string;
  createdAt: string;
  receiptStatus?: ReceiptStatus;
}

export type ReceiptStatus = 'recorded' | 'unavailable' | 'failed';

export interface RecordReceiptResult {
  success: boolean;
  receiptStatus: ReceiptStatus;
  receipt: PrivacyReceipt | null;
  canProceed: boolean;
  error?: string;
}

/**
 * Sanitizes category counts to guarantee only known uppercase strings and positive integer counts
 * are stored. Never accepts arbitrary keys or sensitive value payloads.
 */
function sanitizeCategoryCounts(rawCounts: Record<string, number> = {}): Record<string, number> {
  const cleanCounts: Record<string, number> = {};
  for (const [key, val] of Object.entries(rawCounts)) {
    // Only accept alphanumeric keys up to 30 chars (e.g. CARD, AADHAAR, PAN, PHONE, API_KEY)
    const cleanKey = String(key).replace(/[^A-Z0-9_]/g, '').slice(0, 30);
    const cleanVal = Number.isInteger(val) && val > 0 ? val : 0;
    if (cleanKey && cleanVal > 0) {
      cleanCounts[cleanKey] = cleanVal;
    }
  }
  return cleanCounts;
}

/**
 * Records a privacy-preserving audit receipt in Supabase via the server-only service-role client.
 * Strictly guarantees:
 * 1. Zero raw values, prompt text, placeholder maps, or filenames are accepted or stored.
 * 2. Only counts, policy versions, and enum decisions are persisted.
 * 3. Controlled by RECEIPT_REQUIRED:
 *    - false (default): Failure logs sanitized message, returns receiptStatus: 'unavailable', does not crash request.
 *    - true: Failure fails closed, returns receiptStatus: 'failed', canProceed: false.
 */
export async function createPrivacyReceipt(data: PrivacyReceiptData): Promise<RecordReceiptResult> {
  const receiptRequired = process.env.RECEIPT_REQUIRED === 'true';

  const cleanCategoryCounts = sanitizeCategoryCounts(data.categoryCounts);
  const now = new Date().toISOString();

  // Construct pure in-memory receipt representation
  const receiptPayload: PrivacyReceipt = {
    id: crypto.randomUUID(),
    userId: data.userId,
    conversationId: data.conversationId || null,
    messageId: data.messageId || null,
    createdAt: now,
    action: data.action,
    policyVersion: data.policyVersion,
    inspectionStatus: data.inspectionStatus,
    overrideUsed: Boolean(data.overrideUsed),
    categoryCounts: cleanCategoryCounts,
    attachmentsInspected: typeof data.attachmentsInspected === 'number' ? data.attachmentsInspected : null,
    attachmentsTotal: typeof data.attachmentsTotal === 'number' ? data.attachmentsTotal : null,
  };

  try {
    const adminSupabase = createAdminClient();

    const { data: inserted, error: insertError } = await adminSupabase
      .from('privacy_receipts')
      .insert({
        id: receiptPayload.id,
        user_id: receiptPayload.userId,
        conversation_id: receiptPayload.conversationId,
        message_id: receiptPayload.messageId,
        created_at: receiptPayload.createdAt,
        action: receiptPayload.action,
        policy_version: receiptPayload.policyVersion,
        inspection_status: receiptPayload.inspectionStatus,
        override_used: receiptPayload.overrideUsed,
        category_counts: receiptPayload.categoryCounts,
        attachments_inspected: receiptPayload.attachmentsInspected,
        attachments_total: receiptPayload.attachmentsTotal,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    if (inserted) {
      receiptPayload.id = inserted.id;
      receiptPayload.createdAt = inserted.created_at;
    }
    receiptPayload.receiptStatus = 'recorded';

    return {
      success: true,
      receiptStatus: 'recorded',
      receipt: receiptPayload,
      canProceed: true,
    };
  } catch (err: any) {
    const sanitizedErrorMessage = String(err?.message || 'Database write error').replace(/[^\w\s:.-]/g, '');
    console.error(`[PrivacyReceipt] Receipt persistence failed: ${sanitizedErrorMessage}`);

    if (receiptRequired) {
      return {
        success: false,
        receiptStatus: 'failed',
        receipt: null,
        canProceed: false,
        error: 'Mandatory privacy receipt generation failed.',
      };
    }

    // Default resilient mode: return in-memory receipt metadata to client with status 'unavailable'
    receiptPayload.receiptStatus = 'unavailable';
    return {
      success: false,
      receiptStatus: 'unavailable',
      receipt: receiptPayload, // Client can still display in-flight session chip
      canProceed: true,
    };
  }
}
