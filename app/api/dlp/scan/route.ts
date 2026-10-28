export const maxDuration = 30;

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanDocument, maskPrompt } from '@/src/lib/dlp';
import { recordAuditLog } from '@/lib/dlp/audit-store';
import { sanitizeFilename, detectImageMime } from '@/lib/attachments/validate';

const MAX_SCAN_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    // 1. Authenticate user if session exists (allow guest scanning with local attribution)
    let user: { id?: string; email?: string } | undefined = undefined;
    try {
      const supabase = await createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        user = { id: authUser.id, email: authUser.email };
      }
    } catch {
      // Unauthenticated / local developer mode fallback
    }

    const contentType = request.headers.get('content-type') || '';

    let textContent = '';
    let filename: string | undefined = undefined;
    let fileType: string | undefined = undefined;
    let fileSize: number | undefined = undefined;

    // 2. Handle Multipart File Upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const rawText = formData.get('text') as string | null;

      if (file) {
        if (file.size > MAX_SCAN_FILE_BYTES) {
          return NextResponse.json(
            { error: `File exceeds maximum allowed size of 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).` },
            { status: 400 }
          );
        }

        filename = sanitizeFilename(file.name);
        fileSize = file.size;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        fileType = ext;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Check file type: text-based vs image/binary
        if (['txt', 'csv', 'json', 'md', 'log', 'xml', 'yaml', 'yml', 'tsv'].includes(ext)) {
          textContent = buffer.toString('utf-8');
        } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
          const detectedMime = detectImageMime(buffer);
          if (!detectedMime) {
            return NextResponse.json(
              { error: 'File content does not match genuine image magic bytes.' },
              { status: 400 }
            );
          }
          // Note: client-side performs high-accuracy OCR prior to scan or server processes text
          // If text was also passed via formData from client OCR, use it
          if (rawText && rawText.trim().length > 0) {
            textContent = rawText;
          } else {
            return NextResponse.json(
              {
                error: 'Image files should be scanned via client-side OCR extractor or provided with extracted text.',
                requiresClientOcr: true,
              },
              { status: 422 }
            );
          }
        } else if (ext === 'pdf') {
          if (rawText && rawText.trim().length > 0) {
            textContent = rawText;
          } else {
            return NextResponse.json(
              {
                error: 'PDF files should be processed via client-side PDF extractor or provided with extracted text.',
                requiresClientOcr: true,
              },
              { status: 422 }
            );
          }
        } else {
          // Attempt utf-8 text read
          textContent = buffer.toString('utf-8');
        }
      } else if (rawText) {
        textContent = rawText;
        sourceType: 'text';
      } else {
        return NextResponse.json({ error: 'No file or text provided for scanning.' }, { status: 400 });
      }
    } else {
      // 3. Handle JSON Text Payload
      const body = await request.json().catch(() => ({}));
      textContent = body.text || '';
      filename = body.filename;
      fileType = body.fileType || 'text';
      if (!textContent || textContent.trim().length === 0) {
        return NextResponse.json({ error: 'Text payload cannot be empty.' }, { status: 400 });
      }
    }

    // 4. Run Complete DLP Scan Engine
    const scanResult = scanDocument(textContent, {
      filename,
      fileType,
      fileSize,
    });

    // 5. Generate privacy masked version for review
    if (scanResult.findings.length > 0) {
      const maskedRes = maskPrompt(textContent, scanResult.findings);
      scanResult.maskedText = maskedRes.masked;
    } else {
      scanResult.maskedText = textContent;
    }

    // 6. Record Privacy-Preserving Audit Event
    await recordAuditLog(scanResult, user);

    // 7. Return Result to Frontend
    return NextResponse.json(scanResult);
  } catch (err: any) {
    console.error('[API /api/dlp/scan Error]', err);
    return NextResponse.json(
      { error: err.message || 'An internal error occurred during DLP scan.' },
      { status: 500 }
    );
  }
}
