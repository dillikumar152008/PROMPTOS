'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Message } from '@/types/chat';
import { ChatInput } from './chat-input';
import { Copy, Check, Sparkles, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatThreadProps {
  messages: Message[];
  isLoading: boolean;
  errorMessage?: string | null;
  onSendMessage: (payload: { textToSend: string; placeholderMap?: Record<string, string> }) => void;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  isLoading,
  errorMessage,
  onSendMessage,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#09090b]">
      {isEmpty ? (
        // Empty State: Centered heading & input
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-white shadow-xs">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-white">
              What&apos;s on your mind today?
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md">
              Ask anything, brainstorm ideas, analyze code, or summarize documents with built-in DLP protection.
            </p>
          </div>

          <div className="w-full">
            <ChatInput
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              errorMessage={errorMessage}
              existingMessages={messages}
            />
          </div>
        </div>
      ) : (
        // Active Chat Thread
        <>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const msgKey = msg.id || `msg-${index}`;

                return (
                  <div
                    key={msgKey}
                    className={`flex items-start gap-3 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-emerald-400 shrink-0 mt-0.5">
                        &gt;_
                      </div>
                    )}

                    <div
                      className={`relative group max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-zinc-800 text-zinc-100 rounded-tr-xs'
                          : 'bg-zinc-900/60 border border-zinc-800/80 text-zinc-200 rounded-tl-xs'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap font-sans break-words">{msg.content}</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="prose prose-invert max-w-none text-xs sm:text-sm font-sans leading-relaxed break-words">
                            <ReactMarkdown
                              components={{
                                a: ({ node, ...props }) => (
                                  <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 underline hover:text-emerald-300 font-medium"
                                  />
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>

                          {/* Assistant Message Copy Button */}
                          <div className="pt-2 flex items-center justify-end border-t border-zinc-800/60">
                            <button
                              type="button"
                              onClick={() => handleCopy(msgKey, msg.content)}
                              className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center space-x-1 px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer"
                              title="Copy message"
                            >
                              {copiedId === msgKey ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Assistant Loading Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-emerald-400 shrink-0 mt-0.5">
                    &gt;_
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl rounded-tl-xs px-4 py-3 text-sm text-zinc-400 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse delay-75" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse delay-150" />
                    <span className="text-xs font-mono text-zinc-500 ml-1">PromptOS is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Pinned Input Bar */}
          <div className="border-t border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-xs p-4 sm:p-5">
            <ChatInput
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              errorMessage={errorMessage}
              existingMessages={messages}
            />
          </div>
        </>
      )}
    </div>
  );
};
