import type { WebSocket } from 'ws';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OtpTimeoutError,
  _clearPending,
  cancelOtp,
  submitOtp,
  waitForOtp,
} from '../otp-manager.js';

function makeMockWs() {
  const sent: unknown[] = [];
  const ws = {
    send: (data: string) => sent.push(JSON.parse(data) as unknown),
  } as unknown as WebSocket;
  return { ws, sent };
}

afterEach(() => {
  _clearPending();
  vi.useRealTimers();
});

describe('waitForOtp', () => {
  it('emits otp-required before waiting', async () => {
    const { ws, sent } = makeMockWs();
    const promise = waitForOtp(ws, 'src-1', 5000);
    expect(sent).toEqual([{ type: 'otp-required', sourceId: 'src-1' }]);
    submitOtp('src-1', '123456');
    await promise;
  });

  it('resolves with the submitted OTP string', async () => {
    const { ws } = makeMockWs();
    const promise = waitForOtp(ws, 'src-1', 5000);
    submitOtp('src-1', '987654');
    await expect(promise).resolves.toBe('987654');
  });

  it('rejects with OtpTimeoutError after the timeout elapses', async () => {
    vi.useFakeTimers();
    const { ws } = makeMockWs();
    const promise = waitForOtp(ws, 'src-1', 300);
    vi.advanceTimersByTime(300);
    await expect(promise).rejects.toBeInstanceOf(OtpTimeoutError);
  });

  it('OtpTimeoutError carries the sourceId', async () => {
    vi.useFakeTimers();
    const { ws } = makeMockWs();
    const promise = waitForOtp(ws, 'src-timeout', 100);
    vi.advanceTimersByTime(100);
    try {
      await promise;
    } catch (e) {
      expect(e).toBeInstanceOf(OtpTimeoutError);
      expect((e as OtpTimeoutError).sourceId).toBe('src-timeout');
    }
  });
});

describe('submitOtp', () => {
  it('is a no-op for an unknown sourceId', () => {
    expect(() => submitOtp('does-not-exist', '000000')).not.toThrow();
  });

  it('clears the pending entry so a second submit is a no-op', async () => {
    const { ws } = makeMockWs();
    const promise = waitForOtp(ws, 'src-1', 5000);
    submitOtp('src-1', 'first');
    submitOtp('src-1', 'second'); // should not throw or double-resolve
    await expect(promise).resolves.toBe('first');
  });
});

describe('cancelOtp', () => {
  it('rejects the waiting promise with OtpTimeoutError', async () => {
    const { ws } = makeMockWs();
    const promise = waitForOtp(ws, 'src-1', 5000);
    cancelOtp('src-1');
    await expect(promise).rejects.toBeInstanceOf(OtpTimeoutError);
  });

  it('is a no-op for an unknown sourceId', () => {
    expect(() => cancelOtp('does-not-exist')).not.toThrow();
  });
});

describe('concurrent OTPs for different sourceIds', () => {
  it('resolves each independently', async () => {
    const { ws } = makeMockWs();
    const p1 = waitForOtp(ws, 'src-a', 5000);
    const p2 = waitForOtp(ws, 'src-b', 5000);

    submitOtp('src-a', 'otp-for-a');
    // src-b is still waiting
    await expect(p1).resolves.toBe('otp-for-a');

    submitOtp('src-b', 'otp-for-b');
    await expect(p2).resolves.toBe('otp-for-b');
  });

  it('timing out one does not affect the other', async () => {
    vi.useFakeTimers();
    const { ws } = makeMockWs();
    const p1 = waitForOtp(ws, 'src-short', 100);
    const p2 = waitForOtp(ws, 'src-long', 10_000);

    vi.advanceTimersByTime(100);
    await expect(p1).rejects.toBeInstanceOf(OtpTimeoutError);

    // src-long is still pending — submit it manually
    submitOtp('src-long', 'still-good');
    await expect(p2).resolves.toBe('still-good');
  });
});
