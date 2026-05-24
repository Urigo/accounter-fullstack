import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  requestInteractiveReauth,
  setReauthHandler,
  type ReauthOutcome,
} from '../reauth-coordinator.js';

describe('reauth-coordinator', () => {
  afterEach(() => {
    setReauthHandler(null);
  });

  it("falls back to 'redirect' when no handler is registered", async () => {
    await expect(requestInteractiveReauth()).resolves.toBe('redirect');
  });

  it('delegates to the registered handler', async () => {
    const handler = vi.fn<() => Promise<ReauthOutcome>>().mockResolvedValue('authenticated');
    setReauthHandler(handler);

    await expect(requestInteractiveReauth()).resolves.toBe('authenticated');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is single-flight: concurrent requests share one handler invocation', async () => {
    let resolveHandler: ((outcome: ReauthOutcome) => void) | undefined;
    const handler = vi.fn<() => Promise<ReauthOutcome>>(
      () =>
        new Promise<ReauthOutcome>(resolve => {
          resolveHandler = resolve;
        }),
    );
    setReauthHandler(handler);

    const first = requestInteractiveReauth();
    const second = requestInteractiveReauth();

    expect(handler).toHaveBeenCalledTimes(1);

    resolveHandler?.('authenticated');
    await expect(first).resolves.toBe('authenticated');
    await expect(second).resolves.toBe('authenticated');

    // A subsequent request after settling triggers a fresh handler invocation.
    const third = requestInteractiveReauth();
    expect(handler).toHaveBeenCalledTimes(2);
    resolveHandler?.('redirect');
    await expect(third).resolves.toBe('redirect');
  });
});
