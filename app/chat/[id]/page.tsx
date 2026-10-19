'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Message } from '@/types/chat';
import { ChatThread } from '@/components/chat/chat-thread';
import { createClient } from '@/lib/supabase/client';
import { restorePlaceholders } from '@/src/lib/dlp';

export default function ConversationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const conversationId = params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();
  const conversationMapRef = useRef<Record<string, string>>({});

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
          setMessages(msgs || []);
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
  }, [conversationId, supabase, router]);

  const handleSendMessage = async ({
    textToSend,
    placeholderMap,
    files,
  }: {
    textToSend: string;
    placeholderMap?: Record<string, string>;
    files?: File[];
  }) => {
    setIsLoading(true);
    setErrorMessage(null);

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
        formData.append('message', textToSend || 'Please analyze this image.');
        formData.append('conversationId', conversationId);
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
          }),
        });
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong. Please try again.');
      }

      const rawOutput = data?.output || '';

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

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setErrorMessage(err.message || 'The AI service is busy, try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#09090b] text-zinc-500 font-mono text-xs">
        Loading conversation...
      </div>
    );
  }

  return (
    <ChatThread
      messages={messages}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onSendMessage={handleSendMessage}
    />
  );
}
