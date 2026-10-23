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
  ShieldAlert,
  Image as ImageIcon,
  FileText,
  Languages,
} from 'lucide-react';
import {
  scanPrompt,
  maskPrompt,
  extractMaxIndices,
  restorePlaceholders,
  type Finding,
} from '@/src/lib/dlp';
import { DlpBanner } from '@/components/user/dlp-banner';
import {
  extractTextFromImage,
  type OcrLanguage,
  type OcrProgress,
  LANGUAGE_LABELS,
} from '@/lib/ocr/tesseract-client';
import { extractTextFromPdf } from '@/lib/ocr/pdf-parser';

const MAX_IMAGE_COUNT = 2;
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024; // 3.5 MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_OPTIMIZE_INPUT_CHARS = 2000;
const MAX_MESSAGE_CHARS = 60000;

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

  // OCR states
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrPreviewText, setOcrPreviewText] = useState<string | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('eng');
  const [ocrLangMenuOpen, setOcrLangMenuOpen] = useState(false);
  const [showRawConfirm, setShowRawConfirm] = useState(false);
  const ocrAbortControllerRef = useRef<AbortController | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!input.trim() && selectedFiles.length === 0) || isLoading || isOcrProcessing) return;
    const { masked, map } = maskPrompt(input, findings, baseCounts);
    const filesToSend = [...selectedFiles];
    setInput('');
    clearAttachments();
    setPreviewOptimized(null);
    setUndoOriginalInput(null);
    setShowRawConfirm(false);
    onSendMessage({ textToSend: masked, placeholderMap: map, files: filesToSend });
  };

  const handleEdit = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleRunOcr = async (fileToProcess?: File, langToUse?: OcrLanguage) => {
    const file = fileToProcess || selectedFiles[0];
    if (!file) return;

    const lang = langToUse || ocrLanguage;
    setIsOcrProcessing(true);
    setOcrError(null);
    setOcrPreviewText(null);
    setShowRawConfirm(false);
    setOcrProgress({ status: `Initializing OCR (${LANGUAGE_LABELS[lang]})...`, progress: 5 });

    const controller = new AbortController();
    ocrAbortControllerRef.current = controller;

    try {
      const extracted = await extractTextFromImage(
        file,
        lang,
        (p) => setOcrProgress(p),
        controller.signal
      );

      if (!extracted || extracted.trim().length === 0) {
        setOcrError('No readable text detected in this image. You can attach it as a raw image or try a clearer photo.');
      } else {
        setOcrPreviewText(extracted);
      }
    } catch (err: any) {
      if (err.message?.includes('cancelled')) {
        // user cancelled
      } else {
        setOcrError(err.message || 'Failed to extract text from image.');
      }
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(null);
      ocrAbortControllerRef.current = null;
    }
  };

  const handleCancelOcr = () => {
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
    }
    setIsOcrProcessing(false);
    setOcrProgress(null);
  };

  const handleApplyOcrText = () => {
    if (!ocrPreviewText) return;
    const trimmed = ocrPreviewText.trim();
    if (trimmed.length > MAX_MESSAGE_CHARS) {
      setOcrError(`Extracted text exceeds the maximum character limit (${MAX_MESSAGE_CHARS.toLocaleString()} characters). Please trim before using.`);
      return;
    }

    // Discard raw image attachments so raw image is NEVER sent to server/Gemini
    clearAttachments();

    // If input already has text, append; otherwise set
    const combined = input.trim() ? `${input.trim()}\n\n---\n[Extracted Document Text]:\n${trimmed}` : trimmed;
    setInput(combined);
    onInputChange?.(combined);
    setOcrPreviewText(null);
    setOcrError(null);
    setShowRawConfirm(false);
  };

  const handleDiscardOcr = () => {
    setOcrPreviewText(null);
    setOcrError(null);
  };

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (e.target) {
      e.target.value = '';
    }

    setIsOcrProcessing(true);
    setOcrError(null);
    setOcrPreviewText(null);
    setShowRawConfirm(false);
    setOcrProgress({ status: 'Opening PDF document...', progress: 5 });

    const controller = new AbortController();
    ocrAbortControllerRef.current = controller;

    try {
      const res = await extractTextFromPdf(
        file,
        ocrLanguage,
        (p) => setOcrProgress({ status: p.status, progress: p.progress }),
        controller.signal
      );

      if (!res.text || res.text.trim().length === 0) {
        setOcrError('No readable text or images found in this PDF.');
      } else {
        setOcrPreviewText(res.text);
      }
    } catch (err: any) {
      if (err.message?.includes('cancelled')) {
        // user cancelled
      } else {
        setOcrError(err.message || 'Failed to extract text from PDF.');
      }
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(null);
      ocrAbortControllerRef.current = null;
    }
  };

  const executeSend = (bypassRawCheck = false) => {
    if ((!input.trim() && selectedFiles.length === 0) || isLoading || isOcrProcessing || input.length > MAX_MESSAGE_CHARS) return;

    if (selectedFiles.length > 0 && !bypassRawCheck) {
      setShowRawConfirm(true);
      return;
    }

    setShowRawConfirm(false);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeSend(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSend(false);
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

  const canSend = (input.trim().length > 0 || selectedFiles.length > 0) && !isLoading && !isOcrProcessing && input.length <= MAX_MESSAGE_CHARS;
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

      {/* OCR Progress Banner with Cancel button */}
      {isOcrProcessing && (
        <div className="p-4 rounded-2xl bg-[#2a2a2a] border border-emerald-500/40 text-xs space-y-3 font-sans animate-in fade-in duration-150 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-300 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
              <span>{ocrProgress?.status || 'Reading image with OCR...'}</span>
            </div>
            <button
              type="button"
              onClick={handleCancelOcr}
              className="px-3 py-1 rounded-full bg-[#383838] hover:bg-[#444] text-[#ececec] text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {/* Visual Progress Bar */}
          <div className="w-full bg-[#1e1e1e] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-200 ease-out"
              style={{ width: `${Math.max(5, ocrProgress?.progress || 10)}%` }}
            />
          </div>
        </div>
      )}

      {/* OCR Error Notice */}
      {ocrError && !isOcrProcessing && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 space-y-2.5 animate-in fade-in shadow-md">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-medium">{ocrError}</span>
          </div>
          <div className="flex items-center space-x-2 pt-1 border-t border-red-900/40">
            {selectedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => setOcrError(null)}
                className="px-3 py-1.5 rounded-full bg-[#2a2a2a] hover:bg-[#333] text-[#ececec] text-xs transition-colors cursor-pointer"
              >
                Keep as raw image
              </button>
            )}
            <button
              type="button"
              onClick={handleDiscardOcr}
              className="px-3 py-1.5 rounded-full bg-red-900/40 hover:bg-red-900/60 text-red-200 text-xs transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* OCR Extracted Text Preview Card (Editable + Token Count) */}
      {ocrPreviewText !== null && !isOcrProcessing && (
        <div className="p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] text-xs space-y-3 shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-medium">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Extracted Document Text</span>
              <span className="text-[11px] text-[#9b9b9b] bg-[#333] px-2 py-0.5 rounded-full">
                {LANGUAGE_LABELS[ocrLanguage]}
              </span>
            </div>
            <span className="text-[11px] text-[#9b9b9b]">
              ~{Math.max(1, Math.round(ocrPreviewText.length / (ocrLanguage === 'eng' ? 3.5 : 2.0))).toLocaleString()} tokens ({ocrPreviewText.length.toLocaleString()} chars)
            </span>
          </div>

          <p className="text-[11px] text-[#9b9b9b]">
            Review or edit before using. When accepted, the raw image is discarded and your text is protected by DLP Shield.
          </p>

          <textarea
            rows={5}
            value={ocrPreviewText}
            onChange={(e) => setOcrPreviewText(e.target.value)}
            className="w-full p-3.5 rounded-xl bg-[#212121] text-[#ececec] text-xs font-mono leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500/50 resize-y max-h-72 scrollbar-thin scrollbar-thumb-zinc-800"
          />

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#383838]">
            <button
              type="button"
              onClick={handleApplyOcrText}
              className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Use extracted text</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOcrPreviewText(null);
                setOcrError(null);
              }}
              className="px-3 py-1.5 rounded-full bg-[#303030] hover:bg-[#383838] text-[#ececec] text-xs transition-colors cursor-pointer"
            >
              Keep raw image instead
            </button>

            <button
              type="button"
              onClick={handleDiscardOcr}
              className="px-3 py-1.5 rounded-full bg-[#212121] hover:bg-[#282828] text-[#9b9b9b] text-xs transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Raw Image Fallback Confirmation Banner */}
      {showRawConfirm && selectedFiles.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#2a2a2a] border border-amber-500/50 text-xs space-y-3 font-sans animate-in fade-in duration-150 shadow-lg">
          <div className="flex items-center space-x-2 text-amber-300 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Raw Image Privacy Warning</span>
          </div>
          <p className="text-zinc-300 text-xs leading-relaxed">
            Sensitive data inside images (Aadhaar, PAN, cards, phone numbers) <strong className="text-white">cannot be detected or masked</strong> by DLP Shield. We recommend extracting text with local OCR so sensitive items are masked before leaving your device.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-800/30">
            <button
              type="button"
              onClick={() => handleRunOcr()}
              className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Extract text with OCR (Recommended)</span>
            </button>

            <button
              type="button"
              onClick={() => executeSend(true)}
              className="px-3 py-1.5 rounded-full bg-amber-600/30 hover:bg-amber-600/50 border border-amber-600/40 text-amber-200 text-xs transition-colors cursor-pointer"
            >
              Send raw image anyway
            </button>

            <button
              type="button"
              onClick={() => setShowRawConfirm(false)}
              className="px-3 py-1.5 rounded-full bg-[#303030] hover:bg-[#383838] text-[#ececec] text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
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

      {/* Image DLP Notice (when raw images attached and confirmation not active) */}
      {selectedFiles.length > 0 && !showRawConfirm && (
        <div className="px-4 py-2.5 rounded-2xl bg-[#2a2a2a] text-xs text-[#9b9b9b] flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center space-x-2">
            <Shield className="w-3.5 h-3.5 text-[#9b9b9b] shrink-0" />
            <span>
              <strong className="text-[#ececec] font-medium">Notice:</strong> Sensitive data inside images cannot be masked by DLP Shield.
            </span>
          </div>
          <button
            type="button"
            disabled={isOcrProcessing}
            onClick={() => handleRunOcr()}
            className="shrink-0 text-emerald-400 hover:text-emerald-300 font-medium underline cursor-pointer disabled:opacity-50"
          >
            Extract text with OCR
          </button>
        </div>
      )}

      {/* DLP Warning Banner (for typed or extracted text) */}
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
        {/* Attached Image Thumbnails with OCR buttons and language selector */}
        {selectedFiles.length > 0 && (
          <div className="pb-3 flex flex-wrap items-center gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center space-x-2 bg-[#262626] border border-[#3e3e3e] rounded-xl p-1.5 pr-2.5"
              >
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-[#1e1e1e] shrink-0 border border-[#444]">
                  {previewUrls[idx] ? (
                    <img
                      src={previewUrls[idx]}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-[#9b9b9b]">
                      IMG
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0 pr-1">
                  <span className="text-xs text-[#ececec] font-medium truncate max-w-[120px]">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-[#9b9b9b]">
                    {Math.round(file.size / 1024)} KB
                  </span>
                </div>

                {/* Extract Text OCR button */}
                <button
                  type="button"
                  disabled={isOcrProcessing}
                  onClick={() => handleRunOcr(file)}
                  className="px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium border border-emerald-500/40 flex items-center space-x-1 cursor-pointer transition-colors disabled:opacity-50"
                  title="Extract text with local OCR to protect sensitive data"
                >
                  <FileText className="w-3 h-3 text-emerald-400" />
                  <span>OCR</span>
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  className="p-1 rounded-full hover:bg-[#383838] text-[#9b9b9b] hover:text-[#ececec] transition-colors cursor-pointer"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* OCR Language Selector Pill */}
            <div className="flex items-center space-x-1 bg-[#252525] px-2 py-1 rounded-xl border border-[#383838] text-[11px] text-[#9b9b9b]">
              <Languages className="w-3.5 h-3.5 text-[#9b9b9b]" />
              <span>Lang:</span>
              {(['eng', 'tam', 'hin'] as OcrLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setOcrLanguage(lang)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    ocrLanguage === lang
                      ? 'bg-emerald-500 text-zinc-950 font-semibold'
                      : 'text-[#9b9b9b] hover:text-[#ececec]'
                  }`}
                  title={LANGUAGE_LABELS[lang]}
                >
                  {lang === 'eng' ? 'EN' : lang === 'tam' ? 'தமிழ்' : 'हिन्दी'}
                </button>
              ))}
            </div>
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

        {/* Hidden Image File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Hidden PDF File Input */}
        <input
          ref={pdfFileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handlePdfSelect}
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

                <button
                  type="button"
                  role="menuitem"
                  disabled={isOcrProcessing || isLoading}
                  onClick={() => {
                    setAttachMenuOpen(false);
                    pdfFileInputRef.current?.click();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-[#ececec] hover:bg-[#333333] transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4 h-4 text-[#9b9b9b] shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Add document (PDF)</span>
                    <span className="text-[11px] text-[#9b9b9b]">Client-side OCR (up to 10 pages)</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Right: Optimizer button + Character count + Send button */}
          <div className="flex items-center space-x-2">
            {/* Long text character warning (raised to 60,000 for OCR / documents) */}
            {input.length > 4000 && (
              <span className={`text-[11px] font-sans ${input.length > MAX_MESSAGE_CHARS ? 'text-red-400' : 'text-[#9b9b9b]'}`}>
                {input.length.toLocaleString()}/{MAX_MESSAGE_CHARS.toLocaleString()}
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
