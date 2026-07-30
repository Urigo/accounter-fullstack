/**
 * In-memory rate limiter (spec §11.4).
 *
 * A fixed-window counter keyed by authenticated identity + business scope +
 * tool. Enforced before expensive upstream calls. Phase 1 uses an in-process
 * store; a shared store can replace it later without changing callers.
 */

export interface RateLimitConfig {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed per key per window. */
  max: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = { windowMs: 60_000, max: 60 };

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Milliseconds until the current window resets. */
  retryAfterMs: number;
}

/**
 * Minimal structural limiter contract. Callers depend on this rather than the
 * concrete {@link RateLimiter} class so an alternative implementation (e.g. a
 * shared/Redis-backed limiter) can be swapped in without signature changes.
 */
export interface RateLimiterLike {
  check(key: string): RateLimitResult;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** How many `check` calls between opportunistic sweeps of expired buckets. */
const SWEEP_EVERY = 1000;

/** Build a limiter key scoped to identity + business scope + tool. */
export function rateLimitKey(params: {
  userId: string;
  toolName: string;
  businessIds: readonly string[];
}): string {
  const scope = params.businessIds.length > 0 ? [...params.businessIds].sort().join(',') : 'none';
  return `${params.userId}|${scope}|${params.toolName}`;
}

export class RateLimiter implements RateLimiterLike {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly now: () => number;
  private checksSinceSweep = 0;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT, now: () => number = Date.now) {
    this.windowMs = config.windowMs;
    this.max = config.max;
    this.now = now;
  }

  /**
   * Record a request against `key` and report whether it is allowed. A denied
   * request does not consume additional budget.
   */
  check(key: string): RateLimitResult {
    const now = this.now();
    this.maybeSweep(now);
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    if (bucket.count >= this.max) {
      return {
        allowed: false,
        limit: this.max,
        remaining: 0,
        retryAfterMs: Math.max(0, bucket.resetAt - now),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      limit: this.max,
      remaining: this.max - bucket.count,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
    };
  }

  /**
   * Periodically drop buckets whose window has already elapsed so the map does
   * not grow without bound in a long-lived process with many distinct keys.
   * Runs at most once per {@link SWEEP_EVERY} checks to keep `check` O(1)
   * amortized.
   */
  private maybeSweep(now: number): void {
    this.checksSinceSweep += 1;
    if (this.checksSinceSweep < SWEEP_EVERY) {
      return;
    }
    this.checksSinceSweep = 0;
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }

  /** Test/ops helper: drop all counters. */
  reset(): void {
    this.buckets.clear();
    this.checksSinceSweep = 0;
  }
}

/**
 * Parse the `MCP_RATE_LIMIT_CONFIG` value (JSON `{ "windowMs": …, "max": … }`).
 * Falls back to {@link DEFAULT_RATE_LIMIT} on empty/invalid input.
 */
export function parseRateLimitConfig(raw: string | undefined): RateLimitConfig {
  if (!raw || raw.trim() === '') {
    return DEFAULT_RATE_LIMIT;
  }
  try {
    const parsed = JSON.parse(raw) as { windowMs?: unknown; max?: unknown };
    const windowMs =
      typeof parsed.windowMs === 'number' && Number.isFinite(parsed.windowMs) && parsed.windowMs > 0
        ? parsed.windowMs
        : DEFAULT_RATE_LIMIT.windowMs;
    // Floor before the positivity check so a fractional value in (0, 1) — e.g.
    // `{ "max": 0.5 }` — falls back to the default instead of becoming `max: 0`,
    // which would rate-limit every request.
    const flooredMax =
      typeof parsed.max === 'number' && Number.isFinite(parsed.max)
        ? Math.floor(parsed.max)
        : Number.NaN;
    const max = flooredMax >= 1 ? flooredMax : DEFAULT_RATE_LIMIT.max;
    return { windowMs, max };
  } catch {
    return DEFAULT_RATE_LIMIT;
  }
}
