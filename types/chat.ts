export type MessageRole = 'user' | 'assistant';

export interface ClientPrivacyReceipt {
  id: string;
  action: 'allow' | 'sanitize' | 'review' | 'block' | 'held';
  receipt_status?: 'recorded' | 'unavailable' | 'failed';
  receiptStatus?: 'recorded' | 'unavailable' | 'failed';
  policy_version?: string;
  policyVersion?: string;
  inspection_status?: 'complete' | 'partial' | 'failed';
  inspectionStatus?: 'complete' | 'partial' | 'failed';
  override_used?: boolean;
  overrideUsed?: boolean;
  category_counts?: Record<string, number>;
  categoryCounts?: Record<string, number>;
  created_at?: string;
  createdAt?: string;
  attachments_inspected?: number | null;
  attachmentsInspected?: number | null;
  attachments_total?: number | null;
  attachmentsTotal?: number | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  receipt?: ClientPrivacyReceipt | null;
}

export interface ChatResponse {
  conversationId: string;
  output: string;
  error?: string;
  receipt?: ClientPrivacyReceipt | null;
  receiptStatus?: 'recorded' | 'unavailable' | 'failed';
}
