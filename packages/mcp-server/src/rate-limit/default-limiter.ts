import { env } from '../config/env.js';
import { parseRateLimitConfig, RateLimiter } from './limiter.js';

let cached: RateLimiter | undefined;

/**
 * The process-wide rate limiter, configured from `MCP_RATE_LIMIT_CONFIG`.
 * Lazily created and memoized.
 */
export function getRateLimiter(): RateLimiter {
  cached ??= new RateLimiter(parseRateLimitConfig(env.rateLimit.raw));
  return cached;
}

/** Test-only: reset the memoized limiter. */
export function resetRateLimiter(): void {
  cached = undefined;
}
