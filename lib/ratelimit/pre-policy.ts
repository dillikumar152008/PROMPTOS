import 'server-only';

export interface PrePolicyRateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

export const PRE_POLICY_RPM_LIMIT = 30;
export const PRE_POLICY_WINDOW_SECONDS = 60;

// Module-level in-memory Map for fallback
// Map<identifier, number[]> where number[] is array of request timestamps in ms
const memoryStore = new Map<string, number[]>();

export function _resetPrePolicyMemoryStore(): void {
  memoryStore.clear();
}

/**
 * Extracts client IP from request headers.
 */
export function getClientIp(request: Request): string {
  let forwarded = '';
  if (request.headers) {
    if (typeof request.headers.get === 'function') {
      forwarded = request.headers.get('x-forwarded-for') || '';
    } else if (typeof (request.headers as any)['x-forwarded-for'] === 'string') {
      forwarded = (request.headers as any)['x-forwarded-for'];
    }
  }
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return '127.0.0.1';
}

/**
 * Checks in-memory sliding window rate limit.
 */
function checkMemoryRateLimit(identifier: string, now: number = Date.now()): PrePolicyRateLimitResult {
  const windowStart = now - PRE_POLICY_WINDOW_SECONDS * 1000;
  const timestamps = (memoryStore.get(identifier) || []).filter((t) => t > windowStart);

  if (timestamps.length >= PRE_POLICY_RPM_LIMIT) {
    const oldestInWindow = timestamps[0];
    const retryAfter = Math.max(1, Math.ceil((oldestInWindow + PRE_POLICY_WINDOW_SECONDS * 1000 - now) / 1000));
    memoryStore.set(identifier, timestamps);
    return { allowed: false, retryAfter };
  }

  timestamps.push(now);
  memoryStore.set(identifier, timestamps);

  // Periodic cleanup if store grows large
  if (memoryStore.size > 5000) {
    for (const [key, val] of memoryStore.entries()) {
      const active = val.filter((t) => t > windowStart);
      if (active.length === 0) memoryStore.delete(key);
      else memoryStore.set(key, active);
    }
  }

  return { allowed: true, retryAfter: 0 };
}

/**
 * Checks Upstash Redis if configured, otherwise falls back to memoryStore.
 * Limit: 30 requests per minute per user / IP.
 */
export async function checkPrePolicyRateLimit(
  identifier: string
): Promise<PrePolicyRateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const now = Date.now();
      const currentMinute = Math.floor(now / (PRE_POLICY_WINDOW_SECONDS * 1000));
      const key = `promptos:prepolicy:${identifier}:${currentMinute}`;
      const secondsIntoMinute = Math.floor((now % 60000) / 1000);
      const retryAfter = Math.max(1, 60 - secondsIntoMinute);

      const pipelineBody = [
        ['INCR', key],
        ['EXPIRE', key, '90', 'NX'],
      ];

      const res = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipelineBody),
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const data = await res.json();
        const count = data?.[0]?.result;
        if (typeof count === 'number') {
          if (count > PRE_POLICY_RPM_LIMIT) {
            return { allowed: false, retryAfter };
          }
          return { allowed: true, retryAfter: 0 };
        }
      }
      console.warn('[PrePolicyRateLimit] Upstash pipeline returned unexpected response, falling back to memory');
    } catch (err: any) {
      console.warn('[PrePolicyRateLimit] Upstash error, falling back to memory:', err?.message || err);
    }
  }

  // Fallback to in-memory store
  return checkMemoryRateLimit(identifier);
}
