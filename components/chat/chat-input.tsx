'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowUp, AlertCircle, Loader2 } from 'lucide-react';
import { scanPrompt, maskPrompt, extractMaxIndices, type Finding } from '@/src/lib/dlp';
import { DlpBanner } from '@/components/user/dlp-banner';

interface ChatInputProps {
  onSendMessage: (payload: { textToSend: string; placeholderMap?: Record<string, string> }) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  existingMessages?: { content: string }[];
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  errorMessage,
  existingMessages = [],
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Live scan input as the user types
  const findings: Finding[] = useMemo(() => {
    if (!input) return [];
    return scanPrompt(input);
  }, [input]);

  // 2. Extract conversation-scoped baseCounts from existing conversation messages
  const baseCounts = useMemo(() => {
    return extractMaxIndices((existingMessages || []).map((m) => m.content));
  }, [existingMessages]);

  // Adjust textarea height automatically up to 160px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleMaskAndSend = () => {
    if (!input.trim() || isLoading) return;
    const { masked, map } = maskPrompt(input, findings, baseCounts);
    setInput('');
    onSendMessage({ textToSend: masked, placeholderMap: map });
  };

  const handleEdit = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading || input.length > 4000) return;

      if (findings.length > 0) {
        // If sensitive values are present, always mask before sending
        handleMaskAndSend();
      } else {
        const text = input.trim();
        setInput('');
        onSendMessage({ textToSend: text });
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || input.length > 4000) return;

    if (findings.length > 0) {
      handleMaskAndSend();
    } else {
      const text = input.trim();
      setInput('');
      onSendMessage({ textToSend: text });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Visible Error Banner */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* DLP Warning Banner (Categories, counts, Mask & Send, Edit only) */}
      {findings.length > 0 && (
        <DlpBanner
          findings={findings}
          onMaskAndSend={handleMaskAndSend}
          onEdit={handleEdit}
          disabled={isLoading}
        />
      )}

      {/* Chat Input Container */}
      <form
        onSubmit={handleFormSubmit}
        className={`relative rounded-2xl bg-[#09090b] border transition-colors shadow-lg ${
          findings.length > 0
            ? 'border-amber-500/70 focus-within:border-amber-400'
            : 'border-zinc-800 focus-within:border-zinc-600'
        }`}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Message PromptOS..."
          className="w-full bg-transparent text-zinc-100 text-sm font-sans placeholder:text-zinc-500 px-4 pt-3.5 pb-10 resize-none focus:outline-none leading-relaxed max-h-40 scrollbar-thin scrollbar-thumb-zinc-800"
        />

        {/* Bottom controls inside the textarea box */}
        <div className="absolute left-3 right-3 bottom-2.5 flex items-center justify-between pointer-events-none">
          {/* Character counter (4000 char limit) */}
          <span
            className={`text-[10px] font-mono pointer-events-auto ${
              input.length > 4000 ? 'text-red-400 font-bold' : 'text-zinc-500'
            }`}
          >
            {input.length} / 4000
          </span>

          {/* Send / Loading button */}
          <button
            type="submit"
            disabled={isLoading || !input.trim() || input.length > 4000}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all pointer-events-auto cursor-pointer ${
              isLoading || !input.trim() || input.length > 4000
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'bg-white hover:bg-zinc-200 text-zinc-950 shadow-xs'
            }`}
            title="Send message (Enter)"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </form>

      <div className="text-center text-[11px] text-zinc-500 font-mono">
        PromptOS AI can make mistakes. Verify critical information.
      </div>
    </div>
  );
};
