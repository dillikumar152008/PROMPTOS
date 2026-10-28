'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Message } from '@/types/chat';
import { ChatThread, type PolicyBannerData } from '@/components/chat/chat-thread';
import { createClient } from '@/lib/supabase/client';
import { restorePlaceholders } from '@/src/lib/dlp';

export default function ConversationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const conversationId = params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [wasLastMasked, setWasLastMasked] = useState(false);
  const [historyTrimmed, setHistoryTrimmed] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [policyBanner, setPolicyBanner] = useState<PolicyBannerData | null>(null);

  const supabase = createClient();
  const conversationMapRef = useRef<Record<string, string>>({});
  const pendingReviewPayloadRef = useRef<{
    textToSend: string;
    placeholderMap?: Record<string, string>;
    files?: File[];
    inspectionStatus?: 'complete' | 'partial' | 'failed';
  } | null>(null);

  // Load existing messages for this conversation (RLS enforces own rows only)
  useEffect(() => {
    async function loadConversationMessages() {
      setIsFetchingHistory(true);
      try {
        // First verify conversation exists and belongs to user
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', conversationId)
          .maybeSingle();

        if (convErr || !conv) {
          router.push('/chat');
          return;
        }

        // Fetch messages
        const { data: msgs, error: msgsErr } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (msgsErr) {
          console.error('Failed to load messages:', msgsErr.message);
        } else {
          // Fetch privacy receipts for this conversation (read via user session so RLS applies)
          const { data: receipts } = await supabase
            .from('privacy_receipts')
            .select('*')
            .eq('conversation_id', conversationId);

          const receiptMap = new Map<string, any>();
          if (receipts) {
            for (const r of receipts) {
              if (r.message_id) {
                receiptMap.set(r.message_id, r);
              }
            }
          }

          const enrichedMsgs = (msgs || []).map((m) => ({
            ...m,
            receipt: receiptMap.get(m.id) || null,
          }));

          setMessages(enrichedMsgs);
        }
      } catch (err) {
        console.error('Error loading conversation history:', err);
      } finally {
        setIsFetchingHistory(false);
      }
    }

    if (conversationId) {
      loadConversationMessages();
    }
  }, [conversationId, router, supabase]);

  const handleSendMessage = async ({
    textToSend,
    placeholderMap,
    files,
    confirmReview = false,
    inspectionStatus = 'complete',
  }: {
    textToSend: string;
    placeholderMap?: Record<string, string>;
    files?: File[];
    confirmReview?: boolean;
    inspectionStatus?: 'complete' | 'partial' | 'failed';
  }) => {
    setIsLoading(true);
    setErrorMessage(null);
    setPolicyBanner(null);
    setWasLastMasked(Boolean(placeholderMap && Object.keys(placeholderMap).length > 0));

    let displayContent = textToSend;
    if (files && files.length > 0) {
      const meta = files.map((f) => `[Image: ${f.name} (${Math.round(f.size / 1024)} KB)]`).join('\n');
      displayContent = textToSend ? `${meta}\n\n${textToSend}` : meta;
    }

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      user_id: '',
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    if (placeholderMap && Object.keys(placeholderMap).length > 0) {
      conversationMapRef.current = {
        ...conversationMapRef.current,
        ...placeholderMap,
      };
    }

    try {
      let res: Response;
      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append('message', textToSend || 'Please analyze this document.');
        formData.append('conversationId', conversationId);
        if (confirmReview) formData.append('confirmReview', 'true');
        formData.append('inspectionStatus', inspectionStatus);
        for (const file of files) {
          formData.append('images', file);
        }
        res = await fetch('/api/chat', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            message: textToSend,
            confirmReview,
            inspectionStatus,
          }),
        });
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.action === 'block' || data?.action === 'review' || data?.action === 'held') {
          setPolicyBanner({
            action: data.action,
            error: data.error,
            reasons: data.reasons,
            categoryCounts: data.categoryCounts,
            receipt: data.receipt || null,
          });
          if (data.action === 'review') {
            pendingReviewPayloadRef.current = { textToSend, placeholderMap, files, inspectionStatus };
          }
          if (data.action === 'block' || data.action === 'held') {
            setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
          }
          return;
        }
        throw new Error(data?.error || 'Something went wrong. Please try again.');
      }

      const rawOutput = data?.output || '';
      if (data?.historyTrimmed) {
        setHistoryTrimmed(true);
      }
      if (data?.action === 'sanitize') {
        setWasLastMasked(true);
      }

      // Restore placeholders locally in the browser across all turns in this conversation
      const restoredOutput = restorePlaceholders(rawOutput, conversationMapRef.current);

      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        conversation_id: conversationId,
        user_id: '',
        role: 'assistant',
        content: restoredOutput,
        created_at: new Date().toISOString(),
      };

      // Attach receipt to user message if provided
      if (data?.receipt) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempUserMsg.id ? { ...m, receipt: data.receipt } : m))
        );
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setErrorMessage(err.message || 'The AI service is busy, try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReview = () => {
    if (pendingReviewPayloadRef.current) {
      const payload = { ...pendingReviewPayloadRef.current, confirmReview: true };
      pendingReviewPayloadRef.current = null;
      setPolicyBanner(null);
      handleSendMessage(payload);
    }
  };

  if (isFetchingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#212121] text-[#9b9b9b] font-sans text-xs">
        Loading conversation...
      </div>
    );
  }

  return (
    <ChatThread
      messages={messages}
      isLoading={isLoading}
      errorMessage={errorMessage}
      policyBanner={policyBanner}
      onConfirmReview={handleConfirmReview}
      onClearPolicyBanner={() => setPolicyBanner(null)}
      wasMasked={wasLastMasked}
      historyTrimmed={historyTrimmed}
      onSendMessage={handleSendMessage}
    />
  );
}
