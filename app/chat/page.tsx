'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Message } from '@/types/chat';
import { ChatThread, type PolicyBannerData } from '@/components/chat/chat-thread';
import { restorePlaceholders } from '@/src/lib/dlp';

export default function NewChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [wasLastMasked, setWasLastMasked] = useState(false);
  const [historyTrimmed, setHistoryTrimmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [policyBanner, setPolicyBanner] = useState<PolicyBannerData | null>(null);

  // In-memory ref for client-side placeholder restoration across turns (never persisted)
  const conversationMapRef = useRef<Record<string, string>>({});
  const pendingReviewPayloadRef = useRef<{
    textToSend: string;
    placeholderMap?: Record<string, string>;
    files?: File[];
    inspectionStatus?: 'complete' | 'partial' | 'failed';
  } | null>(null);

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
      conversation_id: activeConvId || '',
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
        if (activeConvId) formData.append('conversationId', activeConvId);
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
            ...(activeConvId ? { conversationId: activeConvId } : {}),
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
          // Remove speculative user message if blocked or held
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
        conversation_id: data.conversationId,
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

      // Update browser URL without remounting the thread component
      if (data.conversationId) {
        if (!activeConvId) {
          setActiveConvId(data.conversationId);
          window.history.replaceState(null, '', `/chat/${data.conversationId}`);
        }
      }
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
