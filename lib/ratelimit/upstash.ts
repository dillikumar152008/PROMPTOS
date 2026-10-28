/**
 * Phase C Rate Limiting — lib/ratelimit/upstash.ts
 *
 * Implements global daily quota (aligned with Google's midnight Pacific Time reset)
 * and per-user daily + per-minute limits using Upstash Redis REST API (native fetch,
 * zero extra npm dependencies).
 *
 * Failure modes:
 *  - Global guard: fail-closed on confirmed exhaustion; fail-open (Supabase fallback)
 *    on Redis unavailable/error.
 *  - Per-user guards: fail-open on Redis errors, fall back to existing DB check.
 */

import 'server-only';

// ─── Pacific Time helpers ─────────────────────────────────────────────────────

/**
 * Returns the current date string in Pacific Time as "YYYY-MM-DD".
 * Used as the Redis key suffix so the window aligns with Google's quota calendar day.
 */
export function getPTDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);
}

/**
 * Returns the UTC timestamp (ms) of midnight PT for the current PT calendar day.
 */
export function getMidnightPT(now: Date = new Date()): Date {
  const ptDateStr = getPTDateKey(now); // e.g. "2026-10-25"
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(now);
  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-7'; // "GMT-7" or "GMT-8"
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  let offsetStr = '-07:00';
  if (match) {
    const sign = match[1];
    const hours = match[2].padStart(2, '0');
    const mins = (match[3] ?? '0').padStart(2, '0');
    offsetStr = `${sign}${hours}:${mins}`;
  }
  return new Date(`${ptDateStr}T00:00:00${offsetStr}`);
}

/**
 * Returns the number of seconds remaining until next midnight PT.
 * Adds a 60-second buffer so keys expire safely after the window ends.
 */
export function secondsUntilMidnightPT(now: Date = new Date()): number {
  const midnight = getMidnightPT(now);
  const nextMidnight = new Date(midnight.getTime() + 86_400_000); // +24h
  const msRemaining = nextMidnight.getTime() - now.getTime();
  return Math.max(60, Math.ceil(msRemaining / 1000) + 60); // at least 60s, +60s buffer
}

// ─── Upstash REST client ──────────────────────────────────────────────────────

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True only when both Upstash env vars are configured. */
function isUpstashConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

interface UpstashPipelineCommand {
  command: string[];
}

interface UpstashPipelineResult {
  result?: number | string | null;
  error?: string;
}

/**
 * Execute multiple Redis commands in a single Upstash pipeline request.
 * Returns null on any network / auth error so callers can fall back gracefully.
 */
async function upstashPipeline(
  commands: UpstashPipelineCommand[]
): Promise<UpstashPipelineResult[] | null> {
  if (!isUpstashConfigured()) return null;

  try {
    const body = commands.map((c) => c.command);
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // 3-second timeout via AbortController
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      console.error('[Upstash] Pipeline HTTP error', res.status);
      return null;
    }

    const data: UpstashPipelineResult[] = await res.json();
    return data;
  } catch (err: any) {
    console.error('[Upstash] Pipeline request failed', err?.message ?? err);
    return null;
  }
}

// ─── Global daily quota ───────────────────────────────────────────────────────

export interface GlobalQuotaResult {
  /** Whether the request is allowed through. */
  allowed: boolean;
  /** Remaining global quota for today. -1 if unknown (fallback path). */
  remaining: number;
  /** Seconds until the quota resets (midnight PT). */
  retryAfter: number;
  /** True when the source was the Supabase fallback (Redis unavailable). */
  usedFallback: boolean;
}

/**
 * Increments and checks the global daily Gemini quota.
 *
 * Key: `promptos:global:daily:<YYYY-MM-DD-PT>`
 * TTL: seconds until next midnight PT + 60s buffer
 *
 * Fail-closed only on confirmed exhaustion (INCR result > GLOBAL_DAILY_LIMIT).
 * If Redis is unavailable, falls back to counting today's assistant messages in Supabase.
 *
 * IMPORTANT: Call this ONLY after validation and DLP pass, immediately before Gemini.
 */
export async function checkGlobalDailyQuota(
  supabase: any
): Promise<GlobalQuotaResult> {
  const limit = parseInt(process.env.GLOBAL_DAILY_LIMIT ?? '20', 10);
  const now = new Date();
  const ptDate = getPTDateKey(now);
  const retryAfter = secondsUntilMidnightPT(now);

  // ── Try Upstash Redis first ──
  if (isUpstashConfigured()) {
    const key = `promptos:global:daily:${ptDate}`;
    const ttl = secondsUntilMidnightPT(now);

    const results = await upstashPipeline([
      { command: ['INCR', key] },
      { command: ['EXPIRE', key, String(ttl), 'NX'] }, // only set TTL if key is new
    ]);

    if (results !== null) {
      const count = results[0]?.result as number;
      if (typeof count === 'number') {
        const remaining = Math.max(0, limit - count);
        const allowed = count <= limit;
        return { allowed, remaining, retryAfter, usedFallback: false };
      }
      // Results malformed — fall through to Supabase fallback
      console.warn('[Upstash] Unexpected INCR result, falling back to Supabase');
    }
    // Pipeline returned null — fall through
  }

  // ── Supabase fallback ──
  try {
    const midnightPT = getMidnightPT(now);
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'assistant')
      .gte('created_at', midnightPT.toISOString());

    if (error) {
      console.error('[Global Quota Fallback] Supabase error', error.message);
      // Cannot determine state — fail-open to avoid blocking all users
      return { allowed: true, remaining: -1, retryAfter, usedFallback: true };
    }

    const todayCount = count ?? 0;
    const remaining = Math.max(0, limit - todayCount);
    // Fail-closed only on confirmed exhaustion
    const allowed = todayCount < limit;
    return { allowed, remaining, retryAfter, usedFallback: true };
  } catch (err: any) {
    console.error('[Global Quota Fallback] Exception', err?.message);
    // Fail-open: cannot confirm exhaustion
    return { allowed: true, remaining: -1, retryAfter, usedFallback: true };
  }
}

// ─── Per-user limits (daily + RPM) ───────────────────────────────────────────

export type RateLimitReason = 'RPM' | 'DAILY' | 'GLOBAL';

export interface UserRateLimitResult {
  /** Whether the request is allowed through. */
  allowed: boolean;
  /** Which limit was hit, if any. */
  reason?: RateLimitReason;
  /** Seconds to wait before retrying. */
  retryAfter: number;
}

/**
 * Checks per-user daily limit and per-minute rate limit.
 *
 * Keys:
 *  - Daily:  `promptos:user:<userId>:daily:<YYYY-MM-DD-PT>`   TTL: until midnight PT
 *  - RPM:    `promptos:user:<userId>:rpm:<YYYY-MM-DD-HH-MM>`  TTL: 90s
 *
 * Fail-open on Redis errors — falls back to the existing 60-second Supabase message count.
 *
 * IMPORTANT: Call this AFTER checkGlobalDailyQuota, still before Gemini.
 */
export async function checkUserRateLimit(
  userId: string,
  supabase: any
): Promise<UserRateLimitResult> {
  const userDailyLimit = parseInt(process.env.USER_DAILY_LIMIT ?? '50', 10);
  const userRpmLimit = parseInt(process.env.USER_RPM_LIMIT ?? '5', 10);

  const now = new Date();
  const ptDate = getPTDateKey(now);
  const retryAfterDay = secondsUntilMidnightPT(now);

  // Current minute key (UTC, minute resolution)
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');
  const minuteKey = `${year}-${month}-${day}-${hour}-${minute}`;

  // ── Try Upstash Redis ──
  if (isUpstashConfigured()) {
    const dailyKey = `promptos:user:${userId}:daily:${ptDate}`;
    const rpmKey = `promptos:user:${userId}:rpm:${minuteKey}`;

    const results = await upstashPipeline([
      { command: ['INCR', dailyKey] },
      { command: ['EXPIRE', dailyKey, String(retryAfterDay), 'NX'] },
      { command: ['INCR', rpmKey] },
      { command: ['EXPIRE', rpmKey, '90', 'NX'] }, // 90s TTL covers the 60s window with buffer
    ]);

    if (results !== null) {
      const dailyCount = results[0]?.result as number;
      const rpmCount = results[2]?.result as number;

      if (typeof dailyCount === 'number' && typeof rpmCount === 'number') {
        // Check RPM first (fastest feedback)
        if (rpmCount > userRpmLimit) {
          return { allowed: false, reason: 'RPM', retryAfter: 60 };
        }
        if (dailyCount > userDailyLimit) {
          return { allowed: false, reason: 'DAILY', retryAfter: retryAfterDay };
        }
        return { allowed: true, retryAfter: 0 };
      }
      console.warn('[Upstash] Unexpected per-user INCR result, falling back to Supabase');
    }
    // Pipeline failed — fall through to Supabase fallback (fail-open)
  }

  // ── Supabase fallback (fail-open) — mirrors existing 60-second check ──
  try {
    const sixtySecsAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', sixtySecsAgo);

    if (error) {
      console.error('[User Rate Limit Fallback] Supabase error', error.message);
      // Fail-open
      return { allowed: true, retryAfter: 0 };
    }

    if ((count ?? 0) >= 10) {
      return { allowed: false, reason: 'RPM', retryAfter: 60 };
    }
    return { allowed: true, retryAfter: 0 };
  } catch (err: any) {
    console.error('[User Rate Limit Fallback] Exception', err?.message);
    return { allowed: true, retryAfter: 0 };
  }
}
