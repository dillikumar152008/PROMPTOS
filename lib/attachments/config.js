export const MAX_IMAGE_COUNT = 2;
export const MAX_TOTAL_ATTACHMENT_BYTES = 3.5 * 1024 * 1024; // 3.5 MB
export const MAX_SINGLE_IMAGE_BYTES = 3.5 * 1024 * 1024;

export const MAX_INPUT_TOKENS = 15000;
export const MAX_HISTORY_MESSAGES = 10;
export const MAX_OUTPUT_TOKENS_WITH_ATTACHMENT = 2048;

export const ALLOWED_IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const ATTACHMENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const MAX_ATTACHMENT_REQUESTS_PER_MINUTE = 5;
