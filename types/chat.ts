export type MessageRole = 'user' | 'assistant';

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
}

export interface ChatResponse {
  conversationId: string;
  output: string;
  error?: string;
}
