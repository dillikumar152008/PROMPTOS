export const maxDuration = 30;

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { scanPrompt } from '@/src/lib/dlp';
import {
  MAX_OPTIMIZE_INPUT_CHARS,
  MAX_OPTIMIZE_OUTPUT_TOKENS,
  OPTIMIZE_RATE_LIMIT_WINDOW_MS,
  OPTIMIZE_RATE_LIMIT_PER_MINUTE,
  PROMPT_OPTIMIZER_SYSTEM_INSTRUCTION,
} from '@/lib/optimizer/config';

// Best-effort in-memory sliding window rate limiter per user on serverless
const optimizerTimestamps = new Map<string, number[]>();

function checkOptimizerRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = optimizerTimestamps.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < OPTIMIZE_RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= OPTIMIZE_RATE_LIMIT_PER_MINUTE) {
    optimizerTimestamps.set(userId, validTimestamps);
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  optimizerTimestamps.set(userId, validTimestamps);
  return { allowed: true, remaining: OPTIMIZE_RATE_LIMIT_PER_MINUTE - validTimestamps.length };
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate with Supabase server client
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. In-memory sliding window rate limiter
    const rateLimit = checkOptimizerRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'You are optimizing prompts too quickly. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    // 3. Parse and validate input prompt
    const body = await request.json().catch(() => null);
    if (!body || typeof body.prompt !== 'string') {
      return NextResponse.json({ error: 'Valid prompt is required.' }, { status: 400 });
    }

    const rawPrompt = body.prompt.trim();
    if (rawPrompt.length < 1) {
      return NextResponse.json({ error: 'Prompt cannot be empty.' }, { status: 400 });
    }

    if (rawPrompt.length > MAX_OPTIMIZE_INPUT_CHARS) {
      return NextResponse.json(
        { error: `Prompt exceeds maximum limit of ${MAX_OPTIMIZE_INPUT_CHARS} characters for optimization.` },
        { status: 400 }
      );
    }

    // 4. Server-side DLP check:
    // If sensitive data was NOT masked by the client, do not mask it silently.
    // Reject with a friendly error so placeholders always originate from the client.
    const inputFindings = scanPrompt(rawPrompt);
    if (inputFindings.length > 0) {
      return NextResponse.json(
        { error: 'Sensitive information detected. Please try again.' },
        { status: 400 }
      );
    }

    // 5. Setup Gemini client
    const model = process.env.GEMINI_MODEL;
    if (!model) {
      console.error('[Optimizer Error] GEMINI_MODEL is missing.');
      return NextResponse.json({ error: 'The AI service is busy, try again.' }, { status: 503 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[Optimizer Error] GEMINI_API_KEY is missing.');
      return NextResponse.json({ error: 'The AI service is busy, try again.' }, { status: 503 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    let outputText = '';
    let lastAiError: any = null;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: rawPrompt }],
          },
        ],
        config: {
          systemInstruction: PROMPT_OPTIMIZER_SYSTEM_INSTRUCTION,
          maxOutputTokens: MAX_OPTIMIZE_OUTPUT_TOKENS,
          thinkingConfig: {
            thinkingBudget: 0,
          },
          abortSignal: controller.signal,
        },
      });

      outputText = response.text?.trim() || '';
    } catch (aiErr: any) {
      lastAiError = aiErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!outputText && lastAiError) {
      const errMsg = lastAiError?.message || '';
      console.error('[Optimizer AI Error]', errMsg);
      if (
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota') ||
        errMsg.includes('rate limit')
      ) {
        return NextResponse.json(
          { error: 'The AI is busy, please try again in a minute.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'The AI service is busy, try again.' },
        { status: 503 }
      );
    }

    if (!outputText) {
      return NextResponse.json(
        { error: "Couldn't optimize safely, your original is kept." },
        { status: 422 }
      );
    }

    // 6. Output DLP check:
    // If output contains any sensitive pattern, discard result and keep original
    const outputFindings = scanPrompt(outputText);
    if (outputFindings.length > 0) {
      return NextResponse.json(
        { error: "Couldn't optimize safely, your original is kept." },
        { status: 422 }
      );
    }

    // 7. Placeholder integrity check:
    // - Every placeholder in the input MUST exist in the output
    // - No new/hallucinated placeholders allowed in the output
    const inputPlaceholders: string[] = rawPrompt.match(/\[[A-Z_]+_\d+\]/g) || [];
    const outputPlaceholders: string[] = outputText.match(/\[[A-Z_]+_\d+\]/g) || [];

    const missing = inputPlaceholders.some((ph: string) => !outputText.includes(ph));
    const inputSet = new Set<string>(inputPlaceholders);
    const alien = outputPlaceholders.some((ph: string) => !inputSet.has(ph));

    if (missing || alien) {
      return NextResponse.json(
        { error: "Couldn't optimize safely, your original is kept." },
        { status: 422 }
      );
    }

    // 8. Output length safeguard: must fit comfortably in textarea (4000 chars)
    if (outputText.length > 4000) {
      return NextResponse.json(
        { error: "Couldn't optimize safely, your original is kept." },
        { status: 422 }
      );
    }

    // Log only counts and status (never log prompt text or optimized text)
    console.log('[Prompt Optimizer]', {
      status: 200,
      inputChars: rawPrompt.length,
      outputChars: outputText.length,
      placeholders: inputPlaceholders.length,
    });

    return NextResponse.json({
      success: true,
      optimizedPrompt: outputText,
    });
  } catch (err: any) {
    console.error('[Prompt Optimizer Unexpected Error]', err?.message || 'Server error');
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
