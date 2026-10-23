'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Message } from '@/types/chat';
import { ChatInput } from './chat-input';
import {
  Copy,
  Check,
  FileText,
  Code,
  Lightbulb,
  Mail,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatThreadProps {
  messages: Message[];
  isLoading: boolean;
  errorMessage?: string | null;
  wasMasked?: boolean;
  historyTrimmed?: boolean;
  onSendMessage: (payload: {
    textToSend: string;
    placeholderMap?: Record<string, string>;
    files?: File[];
  }) => void;
}

// B1-B12: PromptOS is thinking state with subtle text shimmer and honest DLP masking line
const PromptosThinkingState: React.FC<{ wasMasked?: boolean }> = ({ wasMasked }) => {
  const [isStillWorking, setIsStillWorking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsStillWorking(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3.5 justify-start w-full"
    >
      {/* 28px static logo avatar (no pulsing, no motion) */}
      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-zinc-200 shrink-0 mt-0.5 select-none">
        &gt;_
      </div>

      <div className="flex flex-col space-y-1 py-1">
        {/* Main thinking text with subtle gray shimmer (motion-reduced fallback to static text) */}
        <span className="text-sm font-normal text-[#9b9b9b] animate-thinking-shimmer motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-[#9b9b9b]">
          {isStillWorking ? 'Still working…' : 'PromptOS is thinking'}
        </span>

        {/* Real DLP masking line: only when masking actually occurred */}
        {wasMasked && (
          <span className="text-xs text-[#777777] font-normal">
            Sensitive data was masked before sending
          </span>
        )}
      </div>
    </div>
  );
};

// Renders user message, collapsing long extracted document text into an expandable card
const UserMessageBubble: React.FC<{ content: string }> = ({ content }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if content has extracted document text
  const splitMarker = content.includes('---\n[Extracted Document Text]:')
    ? '---\n[Extracted Document Text]:'
    : content.includes('[Extracted Document Text]:')
    ? '[Extracted Document Text]:'
    : null;

  if (!splitMarker) {
    return (
      <div className="max-w-[75%] rounded-3xl bg-[#303030] text-[#ececec] px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </div>
    );
  }

  const parts = content.split(splitMarker);
  const userPrompt = parts[0]?.trim();
  const docText = parts[1]?.trim() || '';

  return (
    <div className="max-w-[75%] space-y-2">
      {userPrompt && (
        <div className="rounded-3xl bg-[#303030] text-[#ececec] px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {userPrompt}
        </div>
      )}

      {/* Collapsed Document Card */}
      <div className="rounded-2xl bg-[#2a2a2a] border border-[#3e3e3e] overflow-hidden text-xs shadow-xs">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#323232] transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-2 text-[#ececec]">
            <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium text-xs">
              Extracted document text ({docText.length.toLocaleString()} characters)
            </span>
          </div>
          <div className="flex items-center space-x-1 text-[#9b9b9b]">
            <span className="text-[11px]">{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="p-3.5 border-t border-[#383838] bg-[#212121] text-[#d4d4d4] font-mono text-[11px] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap break-words scrollbar-thin scrollbar-thumb-zinc-700">
            {docText}
          </div>
        )}
      </div>
    </div>
  );
};

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  isLoading,
  errorMessage,
  wasMasked,
  historyTrimmed = false,
  onSendMessage,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [prefillPrompt, setPrefillPrompt] = useState<string>('');
  const [triggerAttach, setTriggerAttach] = useState<number>(0);
  const [greeting, setGreeting] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set greeting based on local time
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelectPill = (action: { text?: string; isAttach?: boolean }) => {
    if (action.isAttach) {
      setTriggerAttach((prev) => prev + 1);
    } else if (action.text) {
      setPrefillPrompt(action.text);
    }
  };

  const isEmpty = messages.length === 0;

  // A5: 6 suggestion pills in 2 rows
  const emptyPillsRow1 = [
    { label: 'Summarize text', text: 'Summarize this text in 5 bullet points:\n\n', icon: FileText },
    { label: 'Explain code', text: 'Explain what this code does and check for potential bugs:\n\n', icon: Code },
    { label: 'Brainstorm ideas', text: 'Brainstorm 10 creative project ideas for ', icon: Lightbulb },
  ];

  const emptyPillsRow2 = [
    { label: 'Draft an email', text: 'Draft a clear and professional email about ', icon: Mail },
    { label: 'Analyze an image', isAttach: true, icon: ImageIcon },
    { label: 'Improve my prompt', text: 'Improve this prompt: ', icon: Sparkles },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#212121] text-[#ececec] font-sans">
      {isEmpty ? (
        // Empty State: ChatGPT-style centered greeting + heading + composer + 6 pills in 2 rows
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-6">
          <div className="flex flex-col items-center space-y-1.5 text-center">
            {greeting && (
              <span className="text-xs text-[#9b9b9b] font-medium tracking-wide">
                {greeting}
              </span>
            )}
            <h1 className="font-sans text-2xl sm:text-[30px] font-semibold tracking-tight text-[#ececec]">
              What&apos;s on your mind today?
            </h1>
          </div>

          {/* Centered Composer */}
          <div className="w-full">
            <ChatInput
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              errorMessage={errorMessage}
              existingMessages={messages}
              prefillValue={prefillPrompt}
              triggerAttach={triggerAttach}
            />
          </div>

          {/* 6 Suggestion Pills in 2 rows (Disappear once conversation starts) */}
          <div className="flex flex-col items-center gap-2.5 pt-1 w-full select-none">
            {/* Row 1 */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {emptyPillsRow1.map((pill, idx) => {
                const Icon = pill.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPill(pill)}
                    className="px-4 py-2 rounded-full text-xs sm:text-sm text-[#ececec] bg-[#2a2a2a] hover:bg-[#333333] transition-colors cursor-pointer flex items-center space-x-2"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#9b9b9b] shrink-0" />
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 2 */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {emptyPillsRow2.map((pill, idx) => {
                const Icon = pill.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPill(pill)}
                    className="px-4 py-2 rounded-full text-xs sm:text-sm text-[#ececec] bg-[#2a2a2a] hover:bg-[#333333] transition-colors cursor-pointer flex items-center space-x-2"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#9b9b9b] shrink-0" />
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // Active Chat Thread
        <>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* History trimming notice */}
              {historyTrimmed && (
                <div className="flex justify-center select-none animate-in fade-in">
                  <div className="px-3.5 py-1.5 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] text-[11px] text-[#9b9b9b] flex items-center space-x-1.5 shadow-xs">
                    <span>Earlier messages were omitted to fit within the AI context window.</span>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const msgKey = msg.id || `msg-${index}`;

                if (isUser) {
                  // User Message: Right-aligned with collapsible document card if OCR/PDF extracted text present
                  return (
                    <div key={msgKey} className="flex justify-end">
                      <UserMessageBubble content={msg.content} />
                    </div>
                  );
                }

                // Assistant Message: No bubble, no border, plain text on page background with small logo avatar
                return (
                  <div key={msgKey} className="flex items-start gap-3.5 justify-start w-full group">
                    <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-zinc-200 shrink-0 mt-0.5 select-none">
                      &gt;_
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="prose prose-invert max-w-none text-sm font-sans leading-relaxed break-words text-[#ececec]">
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 underline hover:text-blue-300 font-medium"
                              />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Assistant Message Actions: Copy Button (Muted, hover on desktop, visible on mobile) */}
                      <div className="pt-1 flex items-center justify-start opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleCopy(msgKey, msg.content)}
                          className="flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                          title="Copy message"
                        >
                          {copiedId === msgKey ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 text-xs">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-xs">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* B1-B12: PromptOS is thinking state in assistant column */}
              {isLoading && <PromptosThinkingState wasMasked={wasMasked} />}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Pinned Composer Bar with Fade-in Background */}
          <div className="bg-gradient-to-t from-[#212121] via-[#212121]/95 to-transparent p-4 sm:p-5 shrink-0">
            <ChatInput
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              errorMessage={errorMessage}
              existingMessages={messages}
              triggerAttach={triggerAttach}
            />
          </div>
        </>
      )}
    </div>
  );
};
