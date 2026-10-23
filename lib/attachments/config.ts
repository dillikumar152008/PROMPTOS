// Named constants for PromptOS attachment handling and token limits.
// Free-tier Gemini quota is shared across users, so limits are conservative.

export const MAX_IMAGE_COUNT = 2;
export const MAX_TOTAL_ATTACHMENT_BYTES = 3.5 * 1024 * 1024; // 3.5 MB (headroom for multipart overhead)
export const MAX_SINGLE_IMAGE_BYTES = 3.5 * 1024 * 1024;

// Token budget strictly for user prompt + attachments (history budgeted separately)
export const MAX_INPUT_TOKENS = 15000;
export const MAX_HISTORY_MESSAGES = 10;
export const MAX_OUTPUT_TOKENS_WITH_ATTACHMENT = 2048;

export const ALLOWED_IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

// Best-effort in-memory rate limiting per user on serverless
export const ATTACHMENT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const MAX_ATTACHMENT_REQUESTS_PER_MINUTE = 5;
