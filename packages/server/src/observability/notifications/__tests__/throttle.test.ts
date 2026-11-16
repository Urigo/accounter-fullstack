import { describe, expect, it } from 'vitest';
import { createThrottle } from '../throttle.js';

/** What the notifier does for every alert it sends. */
function send(throttle: ReturnType<typeof createThrottle>, fingerprint: string) {
  const decision = throttle.check(fingerprint);
  if (decision.send) {
    throttle.commit(fingerprint);
  }
  return decision;
}

describe('createThrottle', () => {
  it('sends the first, suppresses repeats in the window, and reports them on the next send', () => {
    let now = 0;
    const throttle = createThrottle({ windowMs: 1000, now: () => now });
    expect(send(throttle, 'a')).toEqual({ send: true, suppressed: 0 });
    expect(send(throttle, 'a').send).toBe(false);
    expect(send(throttle, 'a').send).toBe(false);
    expect(send(throttle, 'b').send).toBe(true);
    now = 1000;
    expect(send(throttle, 'a')).toEqual({ send: true, suppressed: 2 });
    expect(send(throttle, 'a').send).toBe(false);
  });

  it('opens no window until the fingerprint is committed', () => {
    let now = 0;
    const throttle = createThrottle({ windowMs: 1000, now: () => now });
    expect(throttle.check('a').send).toBe(true);
    expect(throttle.check('a').send).toBe(true);
    throttle.commit('a');
    now = 10;
    expect(throttle.check('a').send).toBe(false);
  });

  it('stays bounded under a flood of distinct fingerprints', () => {
    const throttle = createThrottle({ windowMs: 60_000, maxEntries: 100 });
    for (let i = 0; i < 10_000; i++) {
      send(throttle, `fp-${i}`);
      expect(throttle.size).toBeLessThanOrEqual(100);
    }
  });
});
