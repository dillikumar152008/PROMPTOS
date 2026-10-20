'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowUp,
  AlertCircle,
  Loader2,
  Paperclip,
  X,
  Sparkles,
  Check,
  Shield,
  Image as ImageIcon,
  FileText,
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
  prefillValue?: string;
  onInputChange?: (val: string) => void;
  triggerAttach?: number;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  errorMessage,
  existingMessages = [],
  prefillValue,
  onInputChange,
  triggerAttach,
}) => {
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);

  // Attach menu popover state
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Optimizer states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [previewOptimized, setPreviewOptimized] = useState<string | null>(null);
  const [undoOriginalInput, setUndoOriginalInput] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live scan input as user types
  const findings: Finding[] = useMemo(() => {
    if (!input) return [];
    return scanPrompt(input);
  }, [input]);

  // Extract baseCounts from existing conversation messages
  const baseCounts = useMemo(() => {
    return extractMaxIndices((existingMessages || []).map((m) => m.content));
  }, [existingMessages]);

  // Adjust textarea height automatically up to 200px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Handle external prefill value from suggestion pills
  useEffect(() => {
    if (prefillValue !== undefined && prefillValue !== '') {
      setInput(prefillValue);
      onInputChange?.(prefillValue);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [prefillValue, onInputChange]);

  // Close attach menu on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAttachMenuOpen(false);
      }
    };

    if (attachMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [attachMenuOpen]);

  // Handle external trigger for attaching images (e.g. from suggestion pill)
  useEffect(() => {
    if (triggerAttach && triggerAttach > 0) {
      fileInputRef.current?.click();
    }
  }, [triggerAttach]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setFileValidationError(null);

    // 1. Check max count
    if (selectedFiles.length + files.length > MAX_IMAGE_COUNT) {
      setFileValidationError(`You can attach up to ${MAX_IMAGE_COUNT} images per prompt.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Validate types
    const invalidType = files.find((f) => !ALLOWED_MIMES.includes(f.type));
    if (invalidType) {
      setFileValidationError(`Unsupported file type (${invalidType.type}). Only PNG, JPG, and WEBP are accepted.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. Validate total size
    const currentTotal = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    const newTotal = files.reduce((acc, f) => acc + f.size, 0);
    if (currentTotal + newTotal > MAX_TOTAL_BYTES) {
      setFileValidationError('Total attachments exceed the 3.5 MB limit. Please select smaller images.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Append files and generate local preview URLs
    const newUrls = files.map((f) => URL.createObjectURL(f));
    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...newUrls]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  const handleOptimize = async () => {
    const trimmed = input.trim();
    if (!trimmed || isOptimizing || isLoading || trimmed.length > MAX_OPTIMIZE_INPUT_CHARS) return;

    setIsOptimizing(true);
    setOptimizationError(null);
    setPreviewOptimized(null);

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

  const canSend = (input.trim().length > 0 || selectedFiles.length > 0) && !isLoading && input.length <= 4000;
  const isOverOptimizeLimit = input.length > MAX_OPTIMIZE_INPUT_CHARS;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-2.5 font-sans">
      {/* Visible Error Banner */}
      {(errorMessage || fileValidationError || optimizationError) && (
        <div className="p-3 rounded-2xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage || fileValidationError || optimizationError}</span>
        </div>
      )}

      {/* Undo Banner if user applied optimization */}
      {undoOriginalInput && (
        <div className="px-4 py-2 rounded-2xl bg-[#2a2a2a] text-xs text-[#ececec] flex items-center justify-between animate-in fade-in">
          <span>Prompt updated with structured version.</span>
          <button
            type="button"
            onClick={handleUndoOptimization}
            className="text-emerald-400 hover:text-emerald-300 text-xs underline cursor-pointer font-medium"
          >
            Undo
          </button>
        </div>
      )}

      {/* Optimization Preview Card */}
      {previewOptimized && (
        <div className="p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] text-xs space-y-3 shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-medium">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Optimized Prompt Preview</span>
            </div>
            <span className="text-[11px] text-[#9b9b9b] bg-[#303030] px-2.5 py-0.5 rounded-full">
              Ready to review
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#212121] text-[#ececec] text-xs whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
            {previewOptimized}
          </div>

          <div className="flex items-center space-x-2 pt-1 border-t border-[#383838]">
            <button
              type="button"
              onClick={handleApplyOptimization}
              className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Use this</span>
            </button>

            <button
              type="button"
              onClick={() => setPreviewOptimized(null)}
              className="px-3 py-1.5 rounded-full bg-[#303030] hover:bg-[#383838] text-[#ececec] text-xs transition-colors cursor-pointer"
            >
              Keep mine
            </button>
          </div>
        </div>
      )}

      {/* Image DLP Notice */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 rounded-2xl bg-[#2a2a2a] text-xs text-[#9b9b9b] flex items-center space-x-2 animate-in fade-in">
          <span>
            <strong className="text-[#ececec] font-medium">Notice:</strong> Sensitive data inside images cannot be detected or masked by DLP Shield.
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

      {/* ChatGPT-style Composer Container (rounded-3xl, #303030, no blue focus rectangle) */}
      <form
        onSubmit={handleFormSubmit}
        className="relative rounded-3xl bg-[#303030] px-5 pt-4 pb-3 sm:px-6 sm:pt-4 sm:pb-3.5 shadow-md border border-transparent focus-within:border-[#4a4a4a] focus-within:bg-[#343434] transition-all"
      >
        {/* Attached Image Thumbnails */}
        {selectedFiles.length > 0 && (
          <div className="pb-2.5 flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="relative group rounded-xl overflow-hidden bg-[#212121] border border-[#424242]"
              >
                {previewUrls[idx] ? (
                  <img
                    src={previewUrls[idx]}
                    alt={file.name}
                    className="w-14 h-14 object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-14 h-14 flex items-center justify-center text-[10px] text-[#9b9b9b]">
                    IMG
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 hover:bg-black text-white transition-opacity"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea (taller min-height, 16px placeholder, no blue outline) */}
        <textarea
          ref={textareaRef}
          rows={2}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            onInputChange?.(e.target.value);
            if (optimizationError) setOptimizationError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={
            selectedFiles.length > 0
              ? 'Ask a question about the attached image...'
              : 'Message PromptOS...'
          }
          className="chat-composer-textarea w-full bg-transparent text-[#ececec] text-base placeholder:text-[#9b9b9b] placeholder:text-base resize-none outline-none !outline-none focus:outline-none focus:!outline-none focus-visible:outline-none focus-visible:!outline-none ring-0 !ring-0 leading-relaxed min-h-[48px] max-h-48 scrollbar-thin scrollbar-thumb-zinc-700"
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

        {/* Bottom Bar inside Composer */}
        <div className="flex items-center justify-between pt-1">
          {/* Left: Attach button with popover */}
          <div className="relative flex items-center space-x-2" ref={attachMenuRef}>
            <button
              type="button"
              disabled={isLoading || selectedFiles.length >= MAX_IMAGE_COUNT}
              onClick={() => setAttachMenuOpen((prev) => !prev)}
              className={`p-2 rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#555] ${
                selectedFiles.length >= MAX_IMAGE_COUNT
                  ? 'text-[#555555] cursor-not-allowed'
                  : 'text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#383838]'
              }`}
              title="Attach files"
              aria-label="Attach files"
              aria-expanded={attachMenuOpen}
              aria-haspopup="menu"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Attach Popover Menu */}
            {attachMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 bottom-full mb-2 w-56 rounded-xl bg-[#2a2a2a] border border-[#383838] shadow-2xl p-1.5 z-50 text-xs font-sans space-y-1 animate-in fade-in duration-100"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={selectedFiles.length >= MAX_IMAGE_COUNT}
                  onClick={() => {
                    setAttachMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-[#ececec] hover:bg-[#333333] transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="w-4 h-4 text-[#9b9b9b] shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Add images</span>
                    <span className="text-[11px] text-[#9b9b9b]">PNG, JPG, WEBP (up to 2)</span>
                  </div>
                </button>

                <div
                  role="menuitem"
                  aria-disabled="true"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[#777777] cursor-not-allowed opacity-60"
                >
                  <div className="flex items-center space-x-2.5">
                    <FileText className="w-4 h-4 text-[#666666] shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-medium">Add documents (OCR)</span>
                      <span className="text-[11px] text-[#666666]">PDF, scanned docs</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#888888] bg-[#212121] px-1.5 py-0.5 rounded">
                    Coming soon
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Optimizer button + Character count + Send button */}
          <div className="flex items-center space-x-2">
            {/* Long text character warning */}
            {input.length > 1600 && (
              <span className={`text-[11px] font-sans ${input.length > 4000 ? 'text-red-400' : 'text-[#9b9b9b]'}`}>
                {input.length}/4000
              </span>
            )}

            {/* Optimizer Button (Appears only when non-whitespace text exists) */}
            <div
              className={`transition-all duration-150 ease-out ${
                input.trim().length > 0 && !isLoading
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-95 pointer-events-none w-0 overflow-hidden'
              }`}
            >
              <button
                type="button"
                disabled={isOptimizing || isLoading || isOverOptimizeLimit}
                onClick={handleOptimize}
                className={`px-3 py-1 rounded-full text-xs transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  isOverOptimizeLimit
                    ? 'bg-[#2a2a2a] text-[#777777] cursor-not-allowed'
                    : 'bg-[#212121] hover:bg-[#282828] text-[#ececec]'
                }`}
                title={
                  isOverOptimizeLimit
                    ? `Input exceeds 2,000 char optimizer limit (${input.length}/2000)`
                    : 'Rewrite into structured prompt'
                }
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    <span>Optimizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Optimize</span>
                  </>
                )}
              </button>
            </div>

            {/* Circular Send Button (White circle when enabled, muted when disabled) */}
            <button
              type="submit"
              disabled={!canSend}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                canSend
                  ? 'bg-white text-zinc-950 hover:opacity-90 cursor-pointer shadow-xs'
                  : 'bg-[#424242] text-[#9b9b9b] cursor-not-allowed opacity-60'
              }`}
              title="Send message"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
      </form>

      {/* DLP Status Line & Disclaimer (A6: two small static muted lines with muted shield icon) */}
      <div className="space-y-1 pt-1 text-center select-none">
        <div className="flex items-center justify-center space-x-1.5 text-xs text-[#9b9b9b]">
          <Shield className="w-3.5 h-3.5 text-[#9b9b9b] shrink-0" />
          <span>
            DLP Shield is on. Aadhaar, PAN, cards, phone numbers and API keys are masked before sending.
          </span>
        </div>
        <p className="text-[11px] text-[#9b9b9b]">
          PromptOS AI can make mistakes. Verify critical information.
        </p>
      </div>
    </div>
  );
};
