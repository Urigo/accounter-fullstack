import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryWithBackoff } from '../auth-callback.js';

// auth-callback.tsx imports Button, which in turn pulls in Radix/UI and DOM-dependent code.
// In this non-jsdom Node test environment, mock Button so those dependencies are never loaded.
vi.mock('../../ui/button.jsx', () => ({}));

// isNetworkError (from auth0-errors) uses `error.error === 'network_error'` or message
// keywords 'network' / 'fetch'.  We replicate the same pattern in our test helpers.
function makeNetworkError(): Error & { error: string } {
  return Object.assign(new Error('fetch failed'), { error: 'network_error' });
}

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately when the first attempt succeeds', async () => {
    const fn = vi.fn().mockResolvedValue({ appState: { returnTo: '/charges' } });

    const result = await retryWithBackoff(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ appState: { returnTo: '/charges' } });
  });

  it('retries on transient network errors and resolves on subsequent attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeNetworkError())
      .mockRejectedValueOnce(makeNetworkError())
      .mockResolvedValueOnce({ appState: { returnTo: '/charges' } });

    const promise = retryWithBackoff(fn);

    // Attempt 0 fails → backoff 750 ms
    await vi.advanceTimersByTimeAsync(750);
    // Attempt 1 fails → backoff 1500 ms
    await vi.advanceTimersByTimeAsync(1500);
    // Attempt 2 succeeds

    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ appState: { returnTo: '/charges' } });
  });

  it('throws after all attempts (maxAttempts = 2) are exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(makeNetworkError());

    const promise = retryWithBackoff(fn);
    // Silence the "unhandled rejection" Node warning while timers advance
    void promise.catch(() => undefined);

    // Advance through both backoff windows
    await vi.advanceTimersByTimeAsync(750);  // after attempt 0
    await vi.advanceTimersByTimeAsync(1500); // after attempt 1
    // Attempt 2 fails and no more retries remain

    await expect(promise).rejects.toMatchObject({ error: 'network_error' });
    // Three total calls: attempts 0, 1, 2
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-network errors and throws immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('access_denied: user closed the tab'));

    const promise = retryWithBackoff(fn);
    // Silence the "unhandled rejection" Node warning while timers advance
    void promise.catch(() => undefined);

    // No timers should advance because no retry was scheduled
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('access_denied: user closed the tab');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies linear (not exponential) back-off: delay 750 ms × (attempt + 1)', async () => {
    const fn = vi.fn().mockRejectedValue(makeNetworkError());
    const promise = retryWithBackoff(fn);
    // Silence the "unhandled rejection" Node warning while timers advance
    void promise.catch(() => undefined);

    // After attempt 0, expect the 750 ms × 1 = 750 ms delay to fire
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(749); // just under – should NOT trigger retry 1
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);   // reaches 750 ms → retry 1 fires
    expect(fn).toHaveBeenCalledTimes(2);

    // After attempt 1, expect the 750 ms × 2 = 1500 ms delay to fire
    await vi.advanceTimersByTimeAsync(1499); // just under – should NOT trigger retry 2
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);    // reaches 1500 ms → retry 2 fires
    expect(fn).toHaveBeenCalledTimes(3);

    // All attempts exhausted
    await expect(promise).rejects.toMatchObject({ error: 'network_error' });
  });

  it('respects a custom maxAttempts override', async () => {
    const fn = vi.fn().mockRejectedValue(makeNetworkError());

    const promise = retryWithBackoff(fn, { maxAttempts: 1, retryDelayMs: 100 });
    // Silence the "unhandled rejection" Node warning while the timer advances
    void promise.catch(() => undefined);

    await vi.advanceTimersByTimeAsync(100); // one retry only

    await expect(promise).rejects.toMatchObject({ error: 'network_error' });
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });
});

