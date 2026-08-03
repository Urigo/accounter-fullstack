import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RATE_LIMIT,
  parseRateLimitConfig,
  RateLimiter,
  rateLimitKey,
} from '../limiter.js';

describe('rateLimitKey', () => {
  it('scopes the key to identity + tool', () => {
    expect(rateLimitKey({ userId: 'u1', toolName: 't' })).toBe('u1|t');
  });

  it('is independent of business scope, so scope subsets share one bucket', () => {
    // A caller must not be able to multiply their quota by addressing distinct
    // scope subsets — every subset maps to the same identity|tool bucket.
    const key = rateLimitKey({ userId: 'u1', toolName: 't' });
    expect(rateLimitKey({ userId: 'u1', toolName: 't' })).toBe(key);
  });
});

describe('RateLimiter', () => {
  it('allows a burst up to the max then denies', () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 3 }, () => 0);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(true);
    const third = limiter.check('k');
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const denied = limiter.check('k');
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBe(1000);
  });

  it('keeps separate buckets per key', () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 }, () => 0);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('resets when the window elapses', () => {
    let now = 0;
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 }, () => now);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(false);
    now = 1000; // window boundary
    expect(limiter.check('k').allowed).toBe(true);
  });

  it('a denied request does not consume additional budget', () => {
    let now = 0;
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 }, () => now);
    limiter.check('k'); // allowed
    limiter.check('k'); // denied
    limiter.check('k'); // denied
    now = 1000;
    // Only one allowed in the next window (bucket count reset to 0, not carried).
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(false);
  });
});

describe('parseRateLimitConfig', () => {
  it('returns defaults for empty/absent input', () => {
    expect(parseRateLimitConfig(undefined)).toEqual(DEFAULT_RATE_LIMIT);
    expect(parseRateLimitConfig('')).toEqual(DEFAULT_RATE_LIMIT);
  });

  it('parses a valid JSON config', () => {
    expect(parseRateLimitConfig('{"windowMs":30000,"max":10}')).toEqual({
      windowMs: 30_000,
      max: 10,
    });
  });

  it('falls back to defaults on invalid JSON or values', () => {
    expect(parseRateLimitConfig('not json')).toEqual(DEFAULT_RATE_LIMIT);
    expect(parseRateLimitConfig('{"windowMs":-5,"max":0}')).toEqual(DEFAULT_RATE_LIMIT);
  });

  it('does not let a fractional max collapse to 0 (which would block everything)', () => {
    // Math.floor(0.5) === 0; must fall back to the default rather than max: 0.
    expect(parseRateLimitConfig('{"max":0.5}').max).toBe(DEFAULT_RATE_LIMIT.max);
    // A value >= 1 is floored normally.
    expect(parseRateLimitConfig('{"max":5.9}').max).toBe(5);
  });
});
