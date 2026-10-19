'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowUp,
  AlertCircle,
  Loader2,
  Paperclip,
  X,
  Image as ImageIcon,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  scanPrompt,
  maskPrompt,
  extractMaxIndices,
  restorePlaceholders,
  type Finding,
} from '@/src/lib/dlp';
import { DlpBanner } from '@/components/user/dlp-banner';

const MAX_IMAGE_COUNT = 2;
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024; // 3.5 MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_OPTIMIZE_INPUT_CHARS = 2000;

interface ChatInputProps {
  onSendMessage: (payload: {
    textToSend: string;
    placeholderMap?: Record<string, string>;
    files?: File[];
  }) => void;
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);

  // Optimizer states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [previewOptimized, setPreviewOptimized] = useState<string | null>(null);
  const [undoOriginalInput, setUndoOriginalInput] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Clean up object URLs when previews change or unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileValidationError(null);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const combined = [...selectedFiles, ...files];
    if (combined.length > MAX_IMAGE_COUNT) {
      setFileValidationError(`You can attach at most ${MAX_IMAGE_COUNT} images per message.`);
      return;
    }

    let totalBytes = 0;
    for (const f of combined) {
      totalBytes += f.size;
      if (!ALLOWED_MIMES.includes(f.type)) {
        setFileValidationError(`File "${f.name}" is not a supported format. Please use PNG, JPG, or WEBP.`);
        return;
      }
    }

    if (totalBytes > MAX_TOTAL_BYTES) {
      setFileValidationError('Total image attachments must not exceed 3.5 MB.');
      return;
    }

    setSelectedFiles(combined);
    const newUrls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls((prev) => [...prev, ...newUrls]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    setFileValidationError(null);
  };

  const clearAttachments = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
    setFileValidationError(null);
  };

  const handleMaskAndSend = () => {
    if ((!input.trim() && selectedFiles.length === 0) || isLoading) return;
    const { masked, map } = maskPrompt(input, findings, baseCounts);
    const filesToSend = [...selectedFiles];
    setInput('');
    clearAttachments();
    setPreviewOptimized(null);
    setUndoOriginalInput(null);
    onSendMessage({ textToSend: masked, placeholderMap: map, files: filesToSend });
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
      if ((!input.trim() && selectedFiles.length === 0) || isLoading || input.length > 4000) return;

      if (findings.length > 0) {
        handleMaskAndSend();
      } else {
        const text = input.trim();
        const filesToSend = [...selectedFiles];
        setInput('');
        clearAttachments();
        setPreviewOptimized(null);
        setUndoOriginalInput(null);
        onSendMessage({ textToSend: text, files: filesToSend });
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && selectedFiles.length === 0) || isLoading || input.length > 4000) return;

    if (findings.length > 0) {
      handleMaskAndSend();
    } else {
      const text = input.trim();
      const filesToSend = [...selectedFiles];
      setInput('');
      clearAttachments();
      setPreviewOptimized(null);
      setUndoOriginalInput(null);
      onSendMessage({ textToSend: text, files: filesToSend });
    }
  };

  // Optimizer trigger
  const handleOptimize = async () => {
    const trimmed = input.trim();
    if (!trimmed || isOptimizing || isLoading || trimmed.length > MAX_OPTIMIZE_INPUT_CHARS) return;

    setIsOptimizing(true);
    setOptimizationError(null);
    setPreviewOptimized(null);

    // 1. Client-side DLP scan & mask: ONLY masked text goes to /api/optimize
    const localFindings = scanPrompt(trimmed);
    let promptToSend = trimmed;
    let localMap: Record<string, string> = {};

    if (localFindings.length > 0) {
      const maskedResult = maskPrompt(trimmed, localFindings, baseCounts);
      promptToSend = maskedResult.masked;
      localMap = maskedResult.map;
    }

    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToSend }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Couldn't optimize safely, your original is kept.");
      }

      const rawOptimized = data?.optimizedPrompt || '';
      if (!rawOptimized) {
        throw new Error("Couldn't optimize safely, your original is kept.");
      }

      // 2. Restore placeholders locally in the browser memory (never sent to server)
      const restored = restorePlaceholders(rawOptimized, localMap);
      setPreviewOptimized(restored);
    } catch (err: any) {
      setOptimizationError(err.message || "Couldn't optimize safely, your original is kept.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyOptimization = () => {
    if (!previewOptimized) return;
    setUndoOriginalInput(input);
    setInput(previewOptimized);
    setPreviewOptimized(null);
    setOptimizationError(null);
  };

  const handleUndoOptimization = () => {
    if (!undoOriginalInput) return;
    setInput(undoOriginalInput);
    setUndoOriginalInput(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Visible Error Banner */}
      {(errorMessage || fileValidationError || optimizationError) && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage || fileValidationError || optimizationError}</span>
        </div>
      )}

      {/* Undo Banner if user applied optimization */}
      {undoOriginalInput && (
        <div className="px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between animate-in fade-in">
          <span>Prompt updated with optimized version.</span>
          <button
            type="button"
            onClick={handleUndoOptimization}
            className="text-emerald-400 hover:text-emerald-300 font-mono text-xs underline cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}

      {/* Optimization Preview Card */}
      {previewOptimized && (
        <div className="p-4 rounded-xl bg-zinc-900/95 border border-zinc-700/80 text-xs space-y-3 shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-zinc-200 font-medium">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-white">Optimized Prompt Preview</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
              Ready to review
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#09090b] border border-zinc-800 text-zinc-300 font-sans text-xs whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
            {previewOptimized}
          </div>

          <div className="flex items-center space-x-2 pt-1 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleApplyOptimization}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Use this</span>
            </button>

            <button
              type="button"
              onClick={() => setPreviewOptimized(null)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 font-mono text-xs transition-colors cursor-pointer"
            >
              Keep mine
            </button>
          </div>
        </div>
      )}

      {/* Image DLP Notice: Honest disclaimer that DLP does not read image pixels */}
      {selectedFiles.length > 0 && (
        <div className="px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] text-zinc-400 flex items-center space-x-2 animate-in fade-in">
          <ImageIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span>
            <strong className="text-zinc-300 font-medium">Image attached:</strong> Sensitive data (Aadhaar, PAN, Card, etc.) inside images cannot be detected or masked by DLP Shield.
          </span>
        </div>
      )}

      {/* DLP Warning Banner (for typed text) */}
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
        {/* Attachment Preview Chips */}
        {selectedFiles.length > 0 && (
          <div className="p-3 pb-0 flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-200 animate-in fade-in"
              >
                {previewUrls[idx] ? (
                  <img
                    src={previewUrls[idx]}
                    alt={file.name}
                    className="w-7 h-7 object-cover rounded shrink-0 border border-zinc-700"
                  />
                ) : (
                  <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                )}
                <div className="flex flex-col min-w-0 max-w-[140px] sm:max-w-[180px]">
                  <span className="truncate text-xs font-mono">{file.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {Math.round(file.size / 1024)} KB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (optimizationError) setOptimizationError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={
            selectedFiles.length > 0
              ? 'Ask a question about the attached image...'
              : 'Message PromptOS...'
          }
          className="w-full bg-transparent text-zinc-100 text-sm font-sans placeholder:text-zinc-500 px-4 pt-3.5 pb-10 resize-none focus:outline-none leading-relaxed max-h-40 scrollbar-thin scrollbar-thumb-zinc-800"
        />

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Bottom controls inside the textarea box */}
        <div className="absolute left-3 right-3 bottom-2.5 flex items-center justify-between pointer-events-none">
          {/* Left: Attachment button & limits caption */}
          <div className="flex items-center space-x-2 pointer-events-auto">
            <button
              type="button"
              disabled={isLoading || selectedFiles.length >= MAX_IMAGE_COUNT}
              onClick={() => fileInputRef.current?.click()}
              className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center space-x-1 cursor-pointer ${
                selectedFiles.length >= MAX_IMAGE_COUNT
                  ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="Attach PNG, JPG, or WEBP (Max 2, up to 3.5 MB total)"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono hidden sm:inline">Attach</span>
            </button>

            <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
              PNG/JPG/WEBP up to 3.5 MB (max 2)
            </span>
          </div>

          {/* Right: Optimize button, Character counter & Send / Loading button */}
          <div className="flex items-center space-x-2.5 pointer-events-auto">
            {/* Animated Optimize Button */}
            <div
              className={`transition-all duration-200 ease-out motion-reduce:transition-none ${
                input.trim().length > 0 && !isLoading
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-95 pointer-events-none w-0 overflow-hidden'
              }`}
            >
              <button
                type="button"
                disabled={isOptimizing || isLoading || input.length > MAX_OPTIMIZE_INPUT_CHARS}
                onClick={handleOptimize}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  input.length > MAX_OPTIMIZE_INPUT_CHARS
                    ? 'border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed'
                    : 'border-zinc-700/80 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white shadow-xs'
                }`}
                title={
                  input.length > MAX_OPTIMIZE_INPUT_CHARS
                    ? `Optimizer limit is 2,000 characters (${input.length}/2000)`
                    : 'Optimize prompt into structured format'
                }
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                    <span>Optimizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Optimize</span>
                    {input.length > MAX_OPTIMIZE_INPUT_CHARS && (
                      <span className="text-[10px] text-amber-500 font-sans ml-0.5">&gt;2k</span>
                    )}
                  </>
                )}
              </button>
            </div>

            <span
              className={`text-[10px] font-mono ${
                input.length > 4000 ? 'text-red-400 font-bold' : 'text-zinc-500'
              }`}
            >
              {input.length} / 4000
            </span>

            <button
              type="submit"
              disabled={
                isLoading ||
                (!input.trim() && selectedFiles.length === 0) ||
                input.length > 4000
              }
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isLoading || (!input.trim() && selectedFiles.length === 0) || input.length > 4000
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
        </div>
      </form>

      <div className="text-center text-[11px] text-zinc-500 font-mono">
        PromptOS AI can make mistakes. Verify critical information.
      </div>
    </div>
  );
};
