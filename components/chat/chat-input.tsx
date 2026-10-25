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

    if (selectedFiles.length + files.length > MAX_IMAGE_COUNT) {
      setFileValidationError(`You can attach up to ${MAX_IMAGE_COUNT} images per prompt.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const invalidType = files.find((f) => !ALLOWED_MIMES.includes(f.type));
    if (invalidType) {
      setFileValidationError(`Unsupported file type (${invalidType.type}). Only PNG, JPG, and WEBP are accepted.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const currentTotal = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    const newTotal = files.reduce((acc, f) => acc + f.size, 0);
    if (currentTotal + newTotal > MAX_TOTAL_BYTES) {
      setFileValidationError('Total attachments exceed the 3.5 MB limit. Please select smaller images.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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

    clearAttachments();

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
    <div className="w-full max-w-3xl mx-auto space-y-2 font-sans">

      {/* ── Error banner ── */}
      {(errorMessage || fileValidationError || optimizationError) && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-300 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          <span>{errorMessage || fileValidationError || optimizationError}</span>
        </div>
      )}

      {/* ── OCR / PDF progress ── */}
      {isOcrProcessing && (
        <div className="px-3.5 py-3 rounded-lg bg-[#262626] border border-[#333] text-xs space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#d4d4d4]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500 shrink-0" />
              <span>{ocrProgress?.status || 'Reading with OCR…'}</span>
            </div>
            <button
              type="button"
              onClick={handleCancelOcr}
              className="text-xs text-[#9b9b9b] hover:text-[#ececec] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="w-full bg-[#1a1a1a] h-1 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-200 ease-out"
              style={{ width: `${Math.max(5, ocrProgress?.progress || 10)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── OCR error ── */}
      {ocrError && !isOcrProcessing && (
        <div className="px-3.5 py-3 rounded-lg bg-red-950/25 border border-red-800/35 text-xs text-red-300 space-y-2.5 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400 mt-0.5" />
            <span>{ocrError}</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-red-900/30">
            {selectedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => setOcrError(null)}
                className="text-xs text-[#9b9b9b] hover:text-[#ececec] transition-colors cursor-pointer"
              >
                Keep as raw image
              </button>
            )}
            <button
              type="button"
              onClick={handleDiscardOcr}
              className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Extracted text preview ── */}
      {ocrPreviewText !== null && !isOcrProcessing && (
        <div className="rounded-lg border border-[#333] bg-[#252525] text-xs animate-in fade-in duration-150 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#333]">
            <div className="flex items-center gap-2 text-[#d4d4d4]">
              <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-medium">Extracted text</span>
              <span className="text-[#9b9b9b] bg-[#1e1e1e] px-1.5 py-0.5 rounded text-[10px]">
                {LANGUAGE_LABELS[ocrLanguage]}
              </span>
            </div>
            <span className="text-[11px] text-[#9b9b9b]">
              ~{Math.max(1, Math.round(ocrPreviewText.length / (ocrLanguage === 'eng' ? 3.5 : 2.0))).toLocaleString()} tokens
            </span>
          </div>

          {/* Editable text area */}
          <textarea
            rows={5}
            value={ocrPreviewText}
            onChange={(e) => setOcrPreviewText(e.target.value)}
            className="w-full px-3.5 py-3 bg-[#1e1e1e] text-[#d4d4d4] text-xs font-mono leading-relaxed outline-none resize-y max-h-64 scrollbar-thin scrollbar-thumb-zinc-700"
          />

          {/* Actions */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-[#333]">
            <p className="text-[11px] text-[#9b9b9b] flex-1">Review or edit before using. Image is discarded; text is DLP-scanned.</p>
            <button
              type="button"
              onClick={handleDiscardOcr}
              className="text-xs text-[#9b9b9b] hover:text-[#ececec] transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => {
                setOcrPreviewText(null);
                setOcrError(null);
              }}
              className="text-xs text-[#9b9b9b] hover:text-[#ececec] transition-colors cursor-pointer"
            >
              Keep raw image
            </button>
            <button
              type="button"
              onClick={handleApplyOcrText}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3" />
              Use text
            </button>
          </div>
        </div>
      )}

      {/* ── Raw image privacy warning ── */}
      {showRawConfirm && selectedFiles.length > 0 && (
        <div className="px-3.5 py-3 rounded-lg border border-amber-500/30 bg-amber-950/15 text-xs animate-in fade-in duration-150">
          <div className="flex items-start gap-2 mb-2.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[#c4c4c4] leading-relaxed">
              Images can't be scanned by DLP Shield. Sensitive data in the image won't be masked.
              <button
                type="button"
                onClick={() => handleRunOcr()}
                className="ml-1 text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
              >
                Extract text with OCR instead
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRawConfirm(false)}
              className="text-xs text-[#9b9b9b] hover:text-[#ececec] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => executeSend(true)}
              className="text-xs text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
            >
              Send raw image anyway
            </button>
          </div>
        </div>
      )}

      {/* ── Undo optimization banner ── */}
      {undoOriginalInput && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#252525] text-xs text-[#9b9b9b] animate-in fade-in">
          <span>Prompt updated.</span>
          <button
            type="button"
            onClick={handleUndoOptimization}
            className="text-emerald-400 hover:text-emerald-300 text-xs cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}

      {/* ── Optimized prompt preview ── */}
      {previewOptimized && (
        <div className="rounded-lg border border-[#333] bg-[#252525] text-xs animate-in fade-in duration-150 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#333]">
            <div className="flex items-center gap-2 text-[#d4d4d4]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-medium">Optimized prompt</span>
            </div>
            <span className="text-[11px] text-[#9b9b9b]">Review before sending</span>
          </div>

          <div className="px-3.5 py-3 text-[#d4d4d4] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 bg-[#1e1e1e]">
            {previewOptimized}
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-[#333]">
            <button
              type="button"
              onClick={() => setPreviewOptimized(null)}
              className="text-xs text-[#9b9b9b] hover:text-[#ececec] transition-colors cursor-pointer"
            >
              Keep mine
            </button>
            <button
              type="button"
              onClick={handleApplyOptimization}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3" />
              Use this
            </button>
          </div>
        </div>
      )}

      {/* ── Image DLP notice ── */}
      {selectedFiles.length > 0 && !showRawConfirm && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#252525] text-xs text-[#9b9b9b] animate-in fade-in">
          <Shield className="w-3 h-3 shrink-0" />
          <span>Images are not scanned by DLP Shield.</span>
          <button
            type="button"
            disabled={isOcrProcessing}
            onClick={() => handleRunOcr()}
            className="ml-auto text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
          >
            Extract text
          </button>
        </div>
      )}

      {/* ── DLP text-findings banner ── */}
      {findings.length > 0 && (
        <DlpBanner
          findings={findings}
          onMaskAndSend={handleMaskAndSend}
          onEdit={handleEdit}
          disabled={isLoading}
        />
      )}

      {/* ── Composer ── */}
      <form
        onSubmit={handleFormSubmit}
        className="relative rounded-2xl bg-[#2f2f2f] border border-transparent focus-within:border-[#555] transition-colors"
      >
        {/* Attached image thumbnails + language selector */}
        {selectedFiles.length > 0 && (
          <div className="px-4 pt-3 pb-0 flex flex-wrap items-center gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center gap-2 bg-[#232323] border border-[#383838] rounded-lg p-1.5 pr-2"
              >
                {/* Thumbnail */}
                <div className="w-8 h-8 rounded overflow-hidden bg-[#1a1a1a] shrink-0">
                  {previewUrls[idx] ? (
                    <img
                      src={previewUrls[idx]}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px] text-[#666]">IMG</div>
                  )}
                </div>

                {/* File info */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-[#d4d4d4] truncate max-w-[100px]">{file.name}</span>
                  <span className="text-[10px] text-[#9b9b9b]">{Math.round(file.size / 1024)} KB</span>
                </div>

                {/* OCR button */}
                <button
                  type="button"
                  disabled={isOcrProcessing}
                  onClick={() => handleRunOcr(file)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40"
                  title="Extract text with OCR"
                >
                  <FileText className="w-3 h-3" />
                  OCR
                </button>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  className="p-0.5 text-[#666] hover:text-[#9b9b9b] transition-colors cursor-pointer"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Language selector */}
            <div className="flex items-center gap-1 text-[11px] text-[#9b9b9b]">
              <Languages className="w-3 h-3" />
              {(['eng', 'tam', 'hin'] as OcrLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setOcrLanguage(lang)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                    ocrLanguage === lang
                      ? 'bg-emerald-600 text-white'
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

        {/* Textarea */}
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
              ? 'Ask a question about the attached image…'
              : 'Message PromptOS…'
          }
          className="chat-composer-textarea w-full px-4 pt-3.5 pb-2 bg-transparent text-[#ececec] text-sm placeholder:text-[#9b9b9b] resize-none outline-none ring-0 leading-relaxed min-h-[52px] max-h-48 scrollbar-thin scrollbar-thumb-zinc-700"
        />

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={pdfFileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handlePdfSelect}
          className="hidden"
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          {/* Left: attach popover */}
          <div className="relative" ref={attachMenuRef}>
            <button
              type="button"
              disabled={isLoading || selectedFiles.length >= MAX_IMAGE_COUNT}
              onClick={() => setAttachMenuOpen((prev) => !prev)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#555] ${
                selectedFiles.length >= MAX_IMAGE_COUNT
                  ? 'text-[#444] cursor-not-allowed'
                  : 'text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#383838]'
              }`}
              title="Attach files"
              aria-label="Attach files"
              aria-expanded={attachMenuOpen}
              aria-haspopup="menu"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Attach menu */}
            {attachMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 bottom-full mb-1.5 w-52 rounded-xl bg-[#222] border border-[#333] shadow-2xl p-1 z-50 text-xs font-sans space-y-0.5 animate-in fade-in duration-100"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={selectedFiles.length >= MAX_IMAGE_COUNT}
                  onClick={() => {
                    setAttachMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#d4d4d4] hover:bg-[#2e2e2e] transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#777] shrink-0" />
                  <div>
                    <div className="font-medium">Add image</div>
                    <div className="text-[10px] text-[#9b9b9b]">PNG, JPG, WEBP · up to 2</div>
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#d4d4d4] hover:bg-[#2e2e2e] transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileText className="w-3.5 h-3.5 text-[#777] shrink-0" />
                  <div>
                    <div className="font-medium">Add PDF</div>
                    <div className="text-[10px] text-[#9b9b9b]">Client-side OCR · up to 10 pages</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Right: char count + optimize + send */}
          <div className="flex items-center gap-2">
            {/* Character count — only visible when long */}
            {input.length > 4000 && (
              <span className={`text-[11px] tabular-nums ${input.length > MAX_MESSAGE_CHARS ? 'text-red-400' : 'text-[#9b9b9b]'}`}>
                {input.length.toLocaleString()}/{MAX_MESSAGE_CHARS.toLocaleString()}
              </span>
            )}

            {/* Optimize button — appears when text present */}
            <div
              className={`transition-all duration-150 ${
                input.trim().length > 0 && !isLoading
                  ? 'opacity-100'
                  : 'opacity-0 pointer-events-none w-0 overflow-hidden'
              }`}
            >
              <button
                type="button"
                disabled={isOptimizing || isLoading || isOverOptimizeLimit}
                onClick={handleOptimize}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                  isOverOptimizeLimit
                    ? 'text-[#555] cursor-not-allowed'
                    : 'text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#383838]'
                }`}
                title={
                  isOverOptimizeLimit
                    ? `Exceeds 2,000-char limit (${input.length}/2000)`
                    : 'Rewrite as structured prompt'
                }
              >
                {isOptimizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isOptimizing ? 'Optimizing…' : 'Optimize'}</span>
              </button>
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={!canSend}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                canSend
                  ? 'bg-white text-zinc-950 hover:bg-zinc-100 cursor-pointer'
                  : 'bg-[#3a3a3a] text-[#555] cursor-not-allowed'
              }`}
              title="Send message"
              aria-label="Send message"
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

      {/* ── DLP status footnote ── */}
      <div className="flex items-center justify-center gap-1.5 pt-0.5 select-none">
        <Shield className="w-3 h-3 shrink-0 text-[#9b9b9b]" />
        <span className="text-xs text-[#9b9b9b]">DLP Shield active · sensitive data is masked before sending</span>
      </div>
    </div>
  );
};
