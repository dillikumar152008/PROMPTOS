import 'server-only';

export interface ModelExecutionParams {
  systemPrompt: string;
  userInput: string;
  maxOutputTokens?: number;
  modelOverride?: string;
}

export interface ModelExecutionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export class UserFacingAIError extends Error {
  public status: number;
  public userMessage: string;

  constructor(userMessage: string, status: number = 500) {
    super(userMessage);
    this.name = 'UserFacingAIError';
    this.userMessage = userMessage;
    this.status = status;
  }
}

/**
 * Maps any error into plain-language user-facing copy without exposing
 * internal JSON, technical codes, model names, or provider errors.
 */
export function getUserFacingAIErrorMessage(err: any): { message: string; status: number } {
  if (err instanceof UserFacingAIError) {
    return { message: err.userMessage, status: err.status };
  }

  const raw = typeof err === 'string' ? err : err?.message || '';

  // 1. Missing model key / not configured
  if (
    raw.includes('No model is configured') ||
    raw.includes('API_KEY') ||
    raw.includes('API key not valid')
  ) {
    return { message: 'No model is configured.', status: 500 };
  }

  // 2. Provider overloaded, rate limited, 503, 429, resource exhausted
  if (
    raw.includes('503') ||
    raw.includes('429') ||
    raw.includes('overloaded') ||
    raw.includes('rate limit') ||
    raw.includes('ResourceExhausted') ||
    raw.includes('Unavailable') ||
    raw.includes('AI service is busy')
  ) {
    return {
      message: 'The AI service is busy right now. Please try again in a minute.',
      status: 429,
    };
  }

  // 3. Application constraints & validations (keep clear messages)
  if (raw.includes('Rate limit exceeded')) {
    return { message: raw, status: 429 };
  }
  if (raw.includes('Input exceeds maximum')) {
    return { message: raw, status: 400 };
  }
  if (raw.includes('paused by its creator')) {
    return { message: raw, status: 403 };
  }
  if (raw.includes('Access pass required')) {
    return { message: raw, status: 403 };
  }
  if (raw.includes('Input payload cannot be empty') || raw.includes('Valid input is required')) {
    return { message: raw, status: 400 };
  }

  // 4. Default generic fallback
  return { message: 'Something went wrong. Please try again.', status: 500 };
}

// In-memory sliding window rate limiter: max 20 runs per minute per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const userRequestTimestamps = new Map<string, number[]>();

export const MAX_INPUT_CHARACTERS = 5000;

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = userRequestTimestamps.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    userRequestTimestamps.set(userId, validTimestamps);
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  userRequestTimestamps.set(userId, validTimestamps);
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - validTimestamps.length };
}

/**
 * Calculates backoff delay respecting Retry-After header or exponential backoff + jitter:
 * Attempt 1 retry: ~1s + jitter (1000 - 1300ms)
 * Attempt 2 retry: ~2s + jitter (2000 - 2400ms)
 */
function getRetryDelayMs(res: Response | null, attempt: number): number {
  if (res) {
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds) && seconds > 0) {
        return Math.min(seconds * 1000, 5000); // capped to 5s max
      }
      const dateMs = Date.parse(retryAfter);
      if (!isNaN(dateMs)) {
        const diff = dateMs - Date.now();
        if (diff > 0) {
          return Math.min(diff, 5000);
        }
      }
    }
  }

  const baseDelay = attempt === 1 ? 1000 : 2000;
  const jitter = Math.floor(Math.random() * (attempt === 1 ? 300 : 400));
  return baseDelay + jitter;
}

/**
 * Execute a model request via native fetch with retries and fallback.
 * - HTTP 503, 500, 429: retries up to 2 times with exponential backoff & jitter.
 * - HTTP 400, 401, 403: does NOT retry.
 * - If retries exhausted and AI_MODEL_FALLBACK is set, tries fallback model once.
 * - Never logs keys; only logs status, code, and message on server.
 */
export async function executeModelPrompt({
  systemPrompt,
  userInput,
  maxOutputTokens = 2048,
  modelOverride,
}: ModelExecutionParams): Promise<ModelExecutionResult> {
  const provider = (process.env.AI_PROVIDER || 'demo').toLowerCase().trim();

  // 1. DEMO PROVIDER
  if (provider === 'demo') {
    return {
      text: `[Demo output, no model connected]\n\nProcessed input:\n${userInput.slice(0, 300)}`,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  // 2. GEMINI PROVIDER
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error('[Provider Error] GEMINI_API_KEY is missing or empty.');
      throw new UserFacingAIError('No model is configured.', 500);
    }

    const primaryModel = modelOverride || process.env.AI_MODEL_RUN || process.env.AI_MODEL_GENERATE || 'gemini-3.5-flash';
    const fallbackModel = process.env.AI_MODEL_FALLBACK?.trim();

    const payload = {
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: userInput }] }],
      generationConfig: {
        maxOutputTokens,
        temperature: 0.7,
      },
    };

    const callGeminiModel = async (model: string): Promise<{ success: boolean; res?: Response; data?: any; status: number; errBody?: string }> => {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          return { success: true, res, data, status: res.status };
        }

        const errBody = await res.text().catch(() => '');
        return { success: false, res, status: res.status, errBody };
      } catch (networkErr: any) {
        return { success: false, status: 0, errBody: networkErr?.message || 'Network error' };
      }
    };

    let lastStatus = 0;
    let lastErrBody = '';

    // Primary model execution with up to 2 retries (3 attempts total)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await callGeminiModel(primaryModel);
      if (result.success && result.data) {
        const candidate = result.data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || '';
        const inputTokens = result.data.usageMetadata?.promptTokenCount ?? Math.max(1, Math.round((systemPrompt.length + userInput.length) / 4));
        const outputTokens = result.data.usageMetadata?.candidatesTokenCount ?? Math.max(1, Math.round(text.length / 4));
        return { text, inputTokens, outputTokens };
      }

      lastStatus = result.status;
      lastErrBody = result.errBody || '';

      // Server-only logging without keys
      console.error('[Provider Error]', {
        provider: 'gemini',
        attempt,
        status: lastStatus,
        message: lastErrBody.slice(0, 300),
      });

      // Do NOT retry client/auth errors (400, 401, 403)
      if (lastStatus === 400 || lastStatus === 401 || lastStatus === 403) {
        if (lastStatus === 401 || lastStatus === 403) {
          throw new UserFacingAIError('No model is configured.', 500);
        }
        throw new UserFacingAIError('Something went wrong. Please try again.', 400);
      }

      // If retryable (503, 500, 429, or network failure) and attempts remain
      if (attempt < 3 && (lastStatus === 503 || lastStatus === 500 || lastStatus === 429 || lastStatus === 0)) {
        const delay = getRetryDelayMs(result.res || null, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // If primary model failed and fallback model is configured, try fallback once
    if (fallbackModel && fallbackModel !== primaryModel) {
      console.warn('[Provider] Primary model failed after retries. Trying fallback model...');
      const fallbackResult = await callGeminiModel(fallbackModel);
      if (fallbackResult.success && fallbackResult.data) {
        const candidate = fallbackResult.data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || '';
        const inputTokens = fallbackResult.data.usageMetadata?.promptTokenCount ?? Math.max(1, Math.round((systemPrompt.length + userInput.length) / 4));
        const outputTokens = fallbackResult.data.usageMetadata?.candidatesTokenCount ?? Math.max(1, Math.round(text.length / 4));
        return { text, inputTokens, outputTokens };
      }

      lastStatus = fallbackResult.status;
      lastErrBody = fallbackResult.errBody || '';
      console.error('[Provider Fallback Error]', {
        provider: 'gemini',
        status: lastStatus,
        message: lastErrBody.slice(0, 300),
      });
    }

    // Determine user-facing error after retries & fallback exhausted
    if (lastStatus === 503 || lastStatus === 429) {
      throw new UserFacingAIError('The AI service is busy right now. Please try again in a minute.', 429);
    }

    throw new UserFacingAIError('Something went wrong. Please try again.', 500);
  }

  // 3. xAI (Grok) PROVIDER
  if (provider === 'xai') {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error('[Provider Error] XAI_API_KEY is missing or empty.');
      throw new UserFacingAIError('No model is configured.', 500);
    }

    const primaryModel = modelOverride || process.env.AI_MODEL_RUN || process.env.AI_MODEL_GENERATE || 'grok-beta';
    const fallbackModel = process.env.AI_MODEL_FALLBACK?.trim();
    const endpoint = 'https://api.x.ai/v1/chat/completions';

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userInput });

    const callXAIModel = async (model: string): Promise<{ success: boolean; res?: Response; data?: any; status: number; errBody?: string }> => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxOutputTokens,
            temperature: 0.7,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          return { success: true, res, data, status: res.status };
        }

        const errBody = await res.text().catch(() => '');
        return { success: false, res, status: res.status, errBody };
      } catch (networkErr: any) {
        return { success: false, status: 0, errBody: networkErr?.message || 'Network error' };
      }
    };

    let lastStatus = 0;
    let lastErrBody = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await callXAIModel(primaryModel);
      if (result.success && result.data) {
        const text = result.data.choices?.[0]?.message?.content || '';
        const inputTokens = result.data.usage?.prompt_tokens ?? Math.max(1, Math.round((systemPrompt.length + userInput.length) / 4));
        const outputTokens = result.data.usage?.completion_tokens ?? Math.max(1, Math.round(text.length / 4));
        return { text, inputTokens, outputTokens };
      }

      lastStatus = result.status;
      lastErrBody = result.errBody || '';

      console.error('[Provider Error]', {
        provider: 'xai',
        attempt,
        status: lastStatus,
        message: lastErrBody.slice(0, 300),
      });

      if (lastStatus === 400 || lastStatus === 401 || lastStatus === 403) {
        if (lastStatus === 401 || lastStatus === 403) {
          throw new UserFacingAIError('No model is configured.', 500);
        }
        throw new UserFacingAIError('Something went wrong. Please try again.', 400);
      }

      if (attempt < 3 && (lastStatus === 503 || lastStatus === 500 || lastStatus === 429 || lastStatus === 0)) {
        const delay = getRetryDelayMs(result.res || null, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    if (fallbackModel && fallbackModel !== primaryModel) {
      console.warn('[Provider] Primary model failed after retries. Trying fallback model...');
      const fallbackResult = await callXAIModel(fallbackModel);
      if (fallbackResult.success && fallbackResult.data) {
        const text = fallbackResult.data.choices?.[0]?.message?.content || '';
        const inputTokens = fallbackResult.data.usage?.prompt_tokens ?? Math.max(1, Math.round((systemPrompt.length + userInput.length) / 4));
        const outputTokens = fallbackResult.data.usage?.completion_tokens ?? Math.max(1, Math.round(text.length / 4));
        return { text, inputTokens, outputTokens };
      }

      lastStatus = fallbackResult.status;
      lastErrBody = fallbackResult.errBody || '';
      console.error('[Provider Fallback Error]', {
        provider: 'xai',
        status: lastStatus,
        message: lastErrBody.slice(0, 300),
      });
    }

    if (lastStatus === 503 || lastStatus === 429) {
      throw new UserFacingAIError('The AI service is busy right now. Please try again in a minute.', 429);
    }

    throw new UserFacingAIError('Something went wrong. Please try again.', 500);
  }

  throw new UserFacingAIError('Something went wrong. Please try again.', 500);
}

/**
 * Backward-compatible helper for mini-app execution routes.
 */
export async function executeMiniAppModel({
  systemPrompt,
  userInput,
  userId,
}: {
  systemPrompt: string;
  userInput: string;
  userId: string;
}): Promise<{ text: string; inputTokens: number; outputTokens: number; latencyMs: number }> {
  const trimmedInput = (userInput || '').trim();
  if (!trimmedInput) {
    throw new UserFacingAIError('Valid input is required.', 400);
  }

  if (trimmedInput.length > MAX_INPUT_CHARACTERS) {
    throw new UserFacingAIError(`Input exceeds maximum limit of ${MAX_INPUT_CHARACTERS} characters.`, 400);
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    throw new UserFacingAIError('Rate limit exceeded: Maximum 20 mini-app executions per minute.', 429);
  }

  const startTime = performance.now();
  const result = await executeModelPrompt({
    systemPrompt,
    userInput: trimmedInput,
    modelOverride: process.env.AI_MODEL_RUN,
  });
  const latencyMs = Math.round(performance.now() - startTime);

  return {
    ...result,
    latencyMs,
  };
}
