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
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Shield,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ClientPrivacyReceipt } from '@/types/chat';

export interface PolicyBannerData {
  action: 'block' | 'review' | 'held' | 'sanitize';
  error?: string;
  reasons?: string[];
  categoryCounts?: Record<string, number>;
  receipt?: ClientPrivacyReceipt | null;
}

interface ChatThreadProps {
  messages: Message[];
  isLoading: boolean;
  errorMessage?: string | null;
  policyBanner?: PolicyBannerData | null;
  onConfirmReview?: () => void;
  onClearPolicyBanner?: () => void;
  wasMasked?: boolean;
  historyTrimmed?: boolean;
  onSendMessage: (payload: {
    textToSend: string;
    placeholderMap?: Record<string, string>;
    files?: File[];
    confirmReview?: boolean;
    inspectionStatus?: 'complete' | 'partial' | 'failed';
  }) => void;
}

// ── Thinking indicator ──────────────────────────────────────────────────────
const ThinkingIndicator: React.FC<{ wasMasked?: boolean }> = ({ wasMasked }) => {
  const [isStillWorking, setIsStillWorking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsStillWorking(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 w-full">
      <Avatar />
      <div className="pt-0.5 space-y-1">
        <span className="text-sm text-[#9b9b9b] animate-thinking-shimmer motion-reduce:animate-none motion-reduce:text-[#9b9b9b]">
          {isStillWorking ? 'Still working…' : 'Thinking…'}
        </span>
        {wasMasked && (
          <span className="block text-xs text-[#9b9b9b]">
            Sensitive data was masked before sending
          </span>
        )}
      </div>
    </div>
  );
};

// ── Small PromptOS avatar ───────────────────────────────────────────────────
const Avatar: React.FC = () => (
  <div className="w-6 h-6 rounded-md bg-[#2a2a2a] border border-[#383838] flex items-center justify-center font-mono font-bold text-[10px] text-[#9b9b9b] shrink-0 mt-0.5 select-none">
    &gt;_
  </div>
);

// ── User message bubble — collapses extracted document text ─────────────────
const UserBubble: React.FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);

  const splitMarker = content.includes('---\n[Extracted Document Text]:')
    ? '---\n[Extracted Document Text]:'
    : content.includes('[Extracted Document Text]:')
    ? '[Extracted Document Text]:'
    : null;

  if (!splitMarker) {
    return (
      <div className="max-w-[78%] rounded-2xl bg-[#2f2f2f] text-[#ececec] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </div>
    );
  }

  const parts = content.split(splitMarker);
  const userPrompt = parts[0]?.trim();
  const docText = parts[1]?.trim() || '';

  return (
    <div className="max-w-[78%] space-y-1.5">
      {userPrompt && (
        <div className="rounded-2xl bg-[#2f2f2f] text-[#ececec] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {userPrompt}
        </div>
      )}

      {/* Collapsible document card */}
      <div className="rounded-xl border border-[#333] bg-[#252525] text-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-[#2e2e2e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 text-[#9b9b9b]">
            <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Extracted document — {docText.length.toLocaleString()} chars</span>
          </div>
          <div className="flex items-center gap-1 text-[#555]">
            <span>{expanded ? 'Hide' : 'Show'}</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </div>
        </button>

        {expanded && (
          <div className="px-3.5 py-3 border-t border-[#333] bg-[#1e1e1e] text-[#c4c4c4] font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap break-words scrollbar-thin scrollbar-thumb-zinc-700">
            {docText}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Privacy Receipt Chip Component ─────────────────────────────────────────
export const PrivacyReceiptChip: React.FC<{
  receipt?: ClientPrivacyReceipt | null;
  className?: string;
}> = ({ receipt, className = '' }) => {
  const [open, setOpen] = useState(false);

  if (!receipt) return null;

  const receiptStatus = receipt.receiptStatus || receipt.receipt_status;
  const isRecorded = receiptStatus === 'recorded';

  const action = receipt.action || 'allow';
  const policyVersion = receipt.policyVersion || receipt.policy_version || 'v1.0';
  const inspectionStatus = receipt.inspectionStatus || receipt.inspection_status || 'complete';
  const overrideUsed = Boolean(receipt.overrideUsed ?? receipt.override_used);
  const categoryCounts = receipt.categoryCounts || receipt.category_counts || {};
  const categoriesList = Object.entries(categoryCounts);

  const actionBadgeStyles: Record<string, string> = {
    block: 'text-red-400 bg-red-950/40 border-red-900/50',
    held: 'text-zinc-300 bg-zinc-800/60 border-zinc-700/50',
    review: 'text-amber-400 bg-amber-950/40 border-amber-900/50',
    sanitize: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50',
    allow: 'text-blue-400 bg-blue-950/40 border-blue-900/50',
  };

  return (
    <div className={`text-left inline-block select-none ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={
          isRecorded
            ? "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-800/60 bg-emerald-950/30 hover:bg-emerald-950/50 hover:border-emerald-700 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            : "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#333] bg-[#222] hover:bg-[#2a2a2a] hover:border-[#444] text-[11px] text-[#888] hover:text-[#aaa] transition-colors cursor-pointer"
        }
        title={isRecorded ? "View minimal privacy-preserving audit receipt" : "Audit receipt not recorded"}
      >
        {isRecorded ? (
          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
        ) : (
          <Shield className="w-3 h-3 text-[#777] shrink-0" />
        )}
        <span className="font-sans">
          {isRecorded ? "Privacy receipt ✓" : "Not recorded"}
        </span>
        <span className={`text-[9px] uppercase px-1 py-0.5 rounded border font-mono ${actionBadgeStyles[action] || actionBadgeStyles.allow}`}>
          {action}
        </span>
        {open ? <ChevronUp className="w-2.5 h-2.5 text-[#777]" /> : <ChevronDown className="w-2.5 h-2.5 text-[#777]" />}
      </button>

      {open && (
        <div className="mt-1.5 p-3 rounded-lg border border-[#333] bg-[#1a1a1a] text-xs text-[#c4c4c4] space-y-2 max-w-sm animate-in fade-in duration-100 shadow-xl">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#2a2a2a]">
            <span className="font-mono text-[11px] font-semibold text-[#ececec]">Audit Metadata</span>
            <span className="font-mono text-[10px] text-[#777]">Policy {policyVersion}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-[#777] block text-[10px]">Record Status</span>
              <span className={`font-mono text-[10px] font-medium ${isRecorded ? 'text-emerald-400' : 'text-[#888]'}`}>
                {receiptStatus || 'unavailable'}
              </span>
            </div>
            <div>
              <span className="text-[#777] block text-[10px]">Decision</span>
              <span className="font-medium text-[#ececec] capitalize">{action}</span>
            </div>
            <div>
              <span className="text-[#777] block text-[10px]">Inspection</span>
              <span className="font-medium text-[#ececec] capitalize">{inspectionStatus}</span>
            </div>
            <div>
              <span className="text-[#777] block text-[10px]">User Override</span>
              <span className="font-medium text-[#ececec]">{overrideUsed ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-[#777] block text-[10px]">Receipt ID</span>
              <span className="font-mono text-[10px] text-[#999] truncate block" title={receipt.id}>
                {receipt.id ? `${receipt.id.slice(0, 8)}…` : 'none'}
              </span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-[#2a2a2a]">
            <span className="text-[#777] block text-[10px] mb-1">Masked / Detected Categories</span>
            {categoriesList.length === 0 ? (
              <span className="text-[11px] text-[#9b9b9b] italic">None (zero findings)</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {categoriesList.map(([cat, count]) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#262626] border border-[#383838] text-[#d4d4d4]"
                  >
                    <span>{cat}:</span>
                    <span className="text-emerald-400 font-semibold">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {receipt.attachmentsTotal !== null && receipt.attachmentsTotal !== undefined && (
            <div className="pt-1 border-t border-[#2a2a2a] text-[10px] text-[#777]">
              <span>Attachments Inspected: </span>
              <span className="text-[#bbb]">
                {receipt.attachmentsInspected ?? 0} / {receipt.attachmentsTotal} (client-reported)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main thread ─────────────────────────────────────────────────────────────
export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  isLoading,
  errorMessage,
  policyBanner,
  onConfirmReview,
  onClearPolicyBanner,
  wasMasked,
  historyTrimmed = false,
  onSendMessage,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [prefillPrompt, setPrefillPrompt] = useState<string>('');
  const [triggerAttach, setTriggerAttach] = useState<number>(0);
  const [greeting, setGreeting] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

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

  const suggestions = [
    { label: 'Optimize a prompt',    text: 'Optimize this prompt:\n\n',                             icon: Sparkles  },
    { label: 'Summarize document',   text: 'Summarize this in 5 key points:\n\n',                   icon: FileText  },
    { label: 'Explain code',         text: 'Explain what this code does and check for bugs:\n\n',   icon: Code      },
    { label: 'Analyze an image',     isAttach: true,                                                icon: ImageIcon },
    { label: 'Draft a message',      text: 'Draft a professional message about ',                   icon: Mail      },
    { label: 'Brainstorm ideas',     text: 'Give me 10 ideas for ',                                 icon: Lightbulb },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#212121] text-[#ececec] font-sans">
      {isEmpty ? (
        /* ── Empty state ── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
          {/* Central composition — restrained width */}
          <div className="w-full max-w-xl mx-auto flex flex-col items-center">

            {/* Heading block */}
            <div className="text-center mb-8">
              {greeting && (
                <p className="text-xs text-[#9b9b9b] mb-2 select-none tracking-wide">{greeting}</p>
              )}
              <h1 className="text-3xl font-semibold text-[#ececec] tracking-tight leading-tight">
                What are we working on?
              </h1>
              <p className="mt-2.5 text-sm text-[#9b9b9b] leading-relaxed">
                Optimize prompts, work with documents, and explore ideas securely.
              </p>
            </div>

            {/* Composer — compact, naturally sized */}
            <div className="w-full">
              <ChatInput
                onSendMessage={onSendMessage}
                isLoading={isLoading}
                errorMessage={errorMessage}
                policyBanner={policyBanner}
                onConfirmReview={onConfirmReview}
                onClearPolicyBanner={onClearPolicyBanner}
                existingMessages={messages}
                prefillValue={prefillPrompt}
                triggerAttach={triggerAttach}
              />
            </div>

            {/* Suggestion chips — compact inline pills, not large cards */}
            <div className="mt-4 flex flex-wrap justify-center gap-2 select-none">
              {suggestions.map((s, i) => {
                const Icon = s.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectPill(s)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[#c4c4c4] bg-[#2a2a2a] hover:bg-[#333333] border border-[#383838] hover:border-[#4a4a4a] hover:text-[#ececec] transition-colors cursor-pointer"
                  >
                    <Icon className="w-3 h-3 shrink-0 text-[#9b9b9b]" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      ) : (
        /* ── Active thread ── */
        <>
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
            <div className="max-w-3xl mx-auto space-y-6">

              {/* Context trimmed notice */}
              {historyTrimmed && (
                <div className="flex justify-center select-none animate-in fade-in">
                  <span className="text-[11px] text-[#9b9b9b] border border-[#383838] rounded-full px-3 py-1">
                    Earlier messages were trimmed to fit the context window.
                  </span>
                </div>
              )}

              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const msgKey = msg.id || `msg-${index}`;

                if (isUser) {
                  return (
                    <div key={msgKey} className="flex flex-col items-end space-y-1">
                      <UserBubble content={msg.content} />
                      {msg.receipt && (
                        <div className="mr-1">
                          <PrivacyReceiptChip receipt={msg.receipt} />
                        </div>
                      )}
                    </div>
                  );
                }

                // Assistant message — no bubble, just text with small avatar
                return (
                  <div key={msgKey} className="flex items-start gap-3 group w-full">
                    <Avatar />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="prose prose-invert max-w-none text-sm font-sans leading-relaxed break-words text-[#e0e0e0]">
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline"
                              />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Copy button — visible on hover */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleCopy(msgKey, msg.content)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[#777] hover:text-[#c4c4c4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                          title="Copy"
                        >
                          {copiedId === msgKey ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Thinking indicator */}
              {isLoading && <ThinkingIndicator wasMasked={wasMasked} />}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Pinned composer */}
          <div className="bg-gradient-to-t from-[#212121] via-[#212121]/90 to-transparent pt-2 pb-4 px-4 sm:px-6 shrink-0">
            <ChatInput
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              errorMessage={errorMessage}
              policyBanner={policyBanner}
              onConfirmReview={onConfirmReview}
              onClearPolicyBanner={onClearPolicyBanner}
              existingMessages={messages}
              triggerAttach={triggerAttach}
            />
          </div>
        </>
      )}
    </div>
  );
};
