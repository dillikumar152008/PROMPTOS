export const maxDuration = 30;

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { scanPrompt } from '@/src/lib/dlp';
import {
  MAX_OPTIMIZE_INPUT_CHARS,
  MAX_OPTIMIZE_OUTPUT_TOKENS,
  PROMPT_OPTIMIZER_SYSTEM_INSTRUCTION,
} from '@/lib/optimizer/config';
import {
  checkGlobalDailyQuota,
  checkUserRateLimit,
} from '@/lib/ratelimit/upstash';
import {
  checkPrePolicyRateLimit,
  getClientIp,
} from '@/lib/ratelimit/pre-policy';
import { runSecurityPipeline } from '@/lib/pipeline';

export async function POST(request: Request) {
  try {
    // 1. Authenticate with Supabase server client
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    // Cheap pre-policy rate limit check BEFORE DLP / policy evaluation
    const rateLimitIdentifier = user?.id ? `user:${user.id}` : `ip:${getClientIp(request)}`;
    if (typeof checkPrePolicyRateLimit === 'function') {
      const preLimit = await checkPrePolicyRateLimit(rateLimitIdentifier);
      if (!preLimit.allowed) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. Please wait before sending another request.',
            retryAfter: preLimit.retryAfter,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(preLimit.retryAfter) },
          }
        );
      }
    }

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate input prompt
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

    const confirmReview = Boolean(body.confirmReview);

    // 3. Security Pipeline Execution (Source of truth)
    const pipelineResult = await runSecurityPipeline({
      text: rawPrompt,
      confirmReview,
    });

    if (pipelineResult.action === 'block') {
      return NextResponse.json(
        {
          error: 'Prompt optimization blocked by security policy.',
          action: 'block',
          reasons: pipelineResult.reasons,
          policyVersion: pipelineResult.policyVersion,
          inspectionStatus: pipelineResult.inspectionStatus,
          categoryCounts: pipelineResult.categoryCounts,
        },
        { status: 403 }
      );
    }

    if (pipelineResult.action === 'held' || pipelineResult.action === 'review') {
      return NextResponse.json(
        {
          error: pipelineResult.action === 'held'
            ? 'Request held: inspection could not be completed.'
            : 'Security review required before optimizing.',
          action: pipelineResult.action,
          reasons: pipelineResult.reasons,
          policyVersion: pipelineResult.policyVersion,
          inspectionStatus: pipelineResult.inspectionStatus,
          categoryCounts: pipelineResult.categoryCounts,
        },
        { status: 422 }
      );
    }

    // 4. Rate limiting: global daily quota + per-user limits (post-policy, pre-Gemini)
    const globalQuota = await checkGlobalDailyQuota(supabase);
    if (!globalQuota.allowed) {
      return NextResponse.json(
        {
          error: 'PromptOS has reached its free daily capacity. Please try again tomorrow.',
          retryAfter: globalQuota.retryAfter,
          isGlobalLimit: true,
          action: 'held',
          reasons: ['Global daily Gemini quota exhausted.'],
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
        : 'You have reached your daily limit. Quota resets tomorrow.';
      return NextResponse.json(
        {
          error,
          retryAfter: userLimit.retryAfter,
          isGlobalLimit: false,
          action: 'held',
          reasons: [error],
        },
        {
          status: 429,
          headers: { 'Retry-After': String(userLimit.retryAfter) },
        }
      );
    }

    // 5. Setup Gemini client
    const model = process.env.GEMINI_MODEL;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!model || !apiKey) {
      console.error('[Optimizer Error] GEMINI_MODEL or GEMINI_API_KEY missing.');
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
            parts: [{ text: pipelineResult.safeText }],
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
    const outputFindings = scanPrompt(outputText);
    if (outputFindings.length > 0) {
      return NextResponse.json(
        { error: "Couldn't optimize safely, your original is kept." },
        { status: 422 }
      );
    }

    // 7. Placeholder integrity check
    const inputPlaceholders: string[] = pipelineResult.safeText.match(/\[[A-Z_]+_\d+\]/g) || [];
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

    if (outputText.length > 4000) {
      return NextResponse.json(
        { error: "Couldn't optimize safely, your original is kept." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      optimizedPrompt: outputText,
      action: pipelineResult.action,
      reasons: pipelineResult.reasons,
      policyVersion: pipelineResult.policyVersion,
      inspectionStatus: pipelineResult.inspectionStatus,
    });
  } catch (err: any) {
    console.error('[Prompt Optimizer Unexpected Error]', err?.message || 'Server error');
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
