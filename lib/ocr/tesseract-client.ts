// Client-side OCR wrapper for Tesseract.js using self-hosted assets in /public/tesseract
// Lazy-loads Tesseract only when invoked in the browser.

export type OcrLanguage = 'eng' | 'tam' | 'hin';

export interface OcrProgress {
  status: string;
  progress: number; // 0 to 100
}

export const LANGUAGE_LABELS: Record<OcrLanguage, string> = {
  eng: 'English',
  tam: 'Tamil (தமிழ்)',
  hin: 'Hindi (हिन्दी)',
};

export async function extractTextFromImage(
  imageSource: File | Blob | string,
  lang: OcrLanguage = 'eng',
  onProgress?: (progress: OcrProgress) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('OCR is only supported in the browser.');
  }

  // Lazy-load tesseract.js so it is never bundled into initial page loads
  const { createWorker } = await import('tesseract.js');

  let worker: any = null;
  let isAborted = false;

  const abortHandler = () => {
    isAborted = true;
    if (worker) {
      worker.terminate().catch(() => {});
    }
  };

  if (abortSignal) {
    if (abortSignal.aborted) {
      throw new Error('OCR cancelled.');
    }
    abortSignal.addEventListener('abort', abortHandler, { once: true });
  }

  try {
    onProgress?.({ status: `Initializing OCR (${LANGUAGE_LABELS[lang]})...`, progress: 5 });

    // Use self-hosted worker and traineddata in /public/tesseract
    worker = await createWorker(lang, 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/tesseract-core-lstm.wasm.js',
      langPath: '/tesseract/tessdata',
      gzip: true,
      logger: (m: any) => {
        if (isAborted) return;
        if (m.status === 'recognizing text') {
          const pct = Math.min(99, Math.max(10, Math.round((m.progress || 0) * 100)));
          onProgress?.({
            status: `Reading image (${LANGUAGE_LABELS[lang]})... ${pct}%`,
            progress: pct,
          });
        } else if (m.status) {
          onProgress?.({
            status: `${m.status.charAt(0).toUpperCase() + m.status.slice(1)}...`,
            progress: 15,
          });
        }
      },
    });

    if (isAborted) {
      throw new Error('OCR cancelled.');
    }

    onProgress?.({ status: `Reading image (${LANGUAGE_LABELS[lang]})...`, progress: 20 });

    const ret = await worker.recognize(imageSource);

    if (isAborted) {
      throw new Error('OCR cancelled.');
    }

    onProgress?.({ status: 'Processing completed', progress: 100 });

    return (ret.data?.text || '').trim();
  } catch (err: any) {
    if (isAborted || err.message?.includes('cancelled')) {
      throw new Error('OCR cancelled.');
    }
    console.error('[OCR Error]', err);
    throw new Error(err.message || 'Failed to extract text from image.');
  } finally {
    if (abortSignal) {
      abortSignal.removeEventListener('abort', abortHandler);
    }
    if (worker) {
      try {
        await worker.terminate();
      } catch (_) {}
    }
  }
}
