import { describe, expect, it } from 'vitest';
import { createThrottle } from '../throttle.js';

describe('createThrottle', () => {
  it('sends the first, suppresses repeats in the window, and reports them on the next send', () => {
    let now = 0;
    const throttle = createThrottle({ windowMs: 1000, now: () => now });
    expect(throttle.check('a')).toEqual({ send: true, suppressed: 0 });
    expect(throttle.check('a').send).toBe(false);
    expect(throttle.check('a').send).toBe(false);
    expect(throttle.check('b').send).toBe(true);
    now = 1000;
    expect(throttle.check('a')).toEqual({ send: true, suppressed: 2 });
    expect(throttle.check('a').send).toBe(false);
  });

  it('stays bounded under a flood of distinct fingerprints', () => {
    const throttle = createThrottle({ windowMs: 60_000, maxEntries: 100 });
    for (let i = 0; i < 10_000; i++) {
      throttle.check(`fp-${i}`);
      expect(throttle.size).toBeLessThanOrEqual(100);
    }
  });
});
