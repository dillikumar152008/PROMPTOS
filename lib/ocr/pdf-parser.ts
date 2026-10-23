// Client-side PDF parser using pdfjs-dist with self-hosted /pdf/pdf.worker.min.js
// Handles digital text extraction per page, with automatic canvas OCR fallback for scanned pages.

import { extractTextFromImage, type OcrLanguage } from './tesseract-client';

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB limit
export const MAX_PDF_PAGES = 10; // Max 10 pages per document
export const SCANNED_PAGE_CHAR_THRESHOLD = 50; // Under 50 chars = image/scanned page

export interface PdfProgress {
  status: string;
  currentPage: number;
  totalPages: number;
  progress: number; // 0 to 100
}

export async function extractTextFromPdf(
  file: File,
  ocrLang: OcrLanguage = 'eng',
  onProgress?: (progress: PdfProgress) => void,
  abortSignal?: AbortSignal
): Promise<{ text: string; pageCount: number; scannedPagesCount: number }> {
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction is only supported in the browser.');
  }

  // 1. File size check
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`PDF exceeds the 10 MB size limit (${(file.size / 1024 / 1024).toFixed(1)} MB). Please upload a smaller file.`);
  }

  onProgress?.({
    status: 'Opening PDF document...',
    currentPage: 0,
    totalPages: 0,
    progress: 5,
  });

  // 2. Client-only dynamic load of pdfjs-dist to avoid SSR node-canvas issues
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();

  let pdf: any;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
      isEvalSupported: false,
    });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => loadingTask.destroy(), { once: true });
    }

    pdf = await loadingTask.promise;
  } catch (err: any) {
    if (abortSignal?.aborted) {
      throw new Error('PDF processing cancelled.');
    }
    if (err?.name === 'PasswordException' || err?.message?.toLowerCase().includes('password')) {
      throw new Error('This PDF is password-protected. Please unlock the file and try again.');
    }
    if (err?.name === 'InvalidPDFException' || err?.message?.toLowerCase().includes('invalid pdf')) {
      throw new Error('This PDF file appears to be corrupted or invalid.');
    }
    throw new Error(err?.message || 'Failed to open PDF document.');
  }

  const numPages = pdf.numPages;
  if (!numPages || numPages === 0) {
    throw new Error('The PDF document contains no pages.');
  }

  // 3. Page count guard
  if (numPages > MAX_PDF_PAGES) {
    throw new Error(`PDF has ${numPages} pages, exceeding the ${MAX_PDF_PAGES}-page limit. Please upload documents with ${MAX_PDF_PAGES} or fewer pages.`);
  }

  const pageTexts: string[] = [];
  let scannedPagesCount = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (abortSignal?.aborted) {
      throw new Error('PDF processing cancelled.');
    }

    const baseProgress = Math.round(((pageNum - 1) / numPages) * 100);
    onProgress?.({
      status: `Extracting text from page ${pageNum} of ${numPages}...`,
      currentPage: pageNum,
      totalPages: numPages,
      progress: baseProgress,
    });

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const extractedChars = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .trim();

    // Check if page is digital or scanned
    if (extractedChars.length >= SCANNED_PAGE_CHAR_THRESHOLD) {
      pageTexts.push(`--- Page ${pageNum} ---\n${extractedChars}`);
    } else {
      // Scanned or image page: render to canvas and run Phase A OCR pipeline
      scannedPagesCount++;
      onProgress?.({
        status: `Running OCR on scanned page ${pageNum} of ${numPages}...`,
        currentPage: pageNum,
        totalPages: numPages,
        progress: baseProgress + Math.round(50 / numPages),
      });

      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for sharp text rendering
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (!ctx) {
        throw new Error('Browser does not support 2D canvas rendering.');
      }

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Convert canvas to blob for OCR processing
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );

      if (!blob) {
        throw new Error(`Failed to capture canvas for page ${pageNum}.`);
      }

      const ocrResult = await extractTextFromImage(
        blob,
        ocrLang,
        (p) => {
          onProgress?.({
            status: `OCR on page ${pageNum}/${numPages}: ${p.status}`,
            currentPage: pageNum,
            totalPages: numPages,
            progress: baseProgress + Math.round((p.progress / 100) * (100 / numPages)),
          });
        },
        abortSignal
      );

      if (ocrResult && ocrResult.trim().length > 0) {
        pageTexts.push(`--- Page ${pageNum} (Scanned OCR) ---\n${ocrResult.trim()}`);
      } else {
        pageTexts.push(`--- Page ${pageNum} ---\n[No readable text detected on this page]`);
      }
    }
  }

  onProgress?.({
    status: 'PDF extraction complete',
    currentPage: numPages,
    totalPages: numPages,
    progress: 100,
  });

  const fullText = pageTexts.join('\n\n').trim();
  return {
    text: fullText,
    pageCount: numPages,
    scannedPagesCount,
  };
}
