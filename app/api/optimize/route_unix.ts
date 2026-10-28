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
import {
  checkGlobalDailyQuota,
  checkUserRateLimit,
} from '@/lib/ratelimit/upstash';

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

    // 2. Parse and validate input prompt (before rate limit so we return fast on bad input)
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

    // 3. Server-side DLP check — placed before rate limit so we don't consume quota on bad requests
    const inputFindings = scanPrompt(rawPrompt);
    if (inputFindings.length > 0) {
      return NextResponse.json(
        { error: 'Sensitive information detected. Please try again.' },
        { status: 400 }
      );
    }

    // 4. Rate limiting: global daily quota + per-user limits (post-validation, pre-Gemini)
    const globalQuota = await checkGlobalDailyQuota(supabase);
    if (!globalQuota.allowed) {
      return NextResponse.json(
        {
          error: 'PromptOS has reached its free daily capacity. Please try again tomorrow.',
          retryAfter: globalQuota.retryAfter,
          isGlobalLimit: true,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(globalQuota.retryAfter) },
        }
      );
    }

    const userLimit = await checkUserRateLimit(user.id, supabase);
    if (!userLimit.allowed) {
      const isRpm = userLimit.reason === 'RPM';
      const error = isRpm
        ? 'You are optimizing prompts too quickly. Please wait a moment.'
        : `You have reached your daily limit. Quota resets tomorrow.`;
      return NextResponse.json(
        {
          error,
          retryAfter: userLimit.retryAfter,
          isGlobalLimit: false,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(userLimit.retryAfter) },
        }
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
