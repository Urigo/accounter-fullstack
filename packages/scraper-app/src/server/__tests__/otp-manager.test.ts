import { afterEach, describe, expect, it, vi } from 'vitest';
import { OtpManager, OtpTimeoutError } from '../otp-manager.js';
import type { ServerMessage } from '../../shared/ws-protocol.js';

function makeEmit() {
  const sent: ServerMessage[] = [];
  const emit = (msg: ServerMessage) => sent.push(msg);
  return { emit, sent };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('waitForOtp', () => {
  it('resolves with the correct string when submitOtp is called', async () => {
    const manager = new OtpManager();
    const { emit } = makeEmit();
    const promise = manager.waitForOtp('src-1', emit);
    manager.submitOtp('src-1', '123456');
    await expect(promise).resolves.toBe('123456');
  });

  it('rejects with OtpTimeoutError after timeout elapses', async () => {
    vi.useFakeTimers();
    const manager = new OtpManager();
    const { emit } = makeEmit();
    const promise = manager.waitForOtp('src-1', emit, 100);
    vi.advanceTimersByTime(100);
    await expect(promise).rejects.toBeInstanceOf(OtpTimeoutError);
  });

  it('emits otp-required immediately on call', async () => {
    const manager = new OtpManager();
    const { emit, sent } = makeEmit();
    const promise = manager.waitForOtp('src-1', emit);
    expect(sent).toEqual([{ type: 'otp-required', sourceId: 'src-1' }]);
    manager.submitOtp('src-1', 'x');
    await promise;
  });

  it('OtpTimeoutError carries the sourceId', async () => {
    vi.useFakeTimers();
    const manager = new OtpManager();
    const { emit } = makeEmit();
    const promise = manager.waitForOtp('src-timeout', emit, 100);
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
    const manager = new OtpManager();
    expect(() => manager.submitOtp('does-not-exist', '000000')).not.toThrow();
  });

  it('clears the pending entry so a second submit is a no-op', async () => {
    const manager = new OtpManager();
    const { emit } = makeEmit();
    const promise = manager.waitForOtp('src-1', emit);
    manager.submitOtp('src-1', 'first');
    manager.submitOtp('src-1', 'second'); // should not throw or double-resolve
    await expect(promise).resolves.toBe('first');
  });
});

describe('cancelOtp', () => {
  it('rejects the waiting promise with OtpTimeoutError', async () => {
    const manager = new OtpManager();
    const { emit } = makeEmit();
    const promise = manager.waitForOtp('src-1', emit);
    manager.cancelOtp('src-1');
    await expect(promise).rejects.toBeInstanceOf(OtpTimeoutError);
  });

  it('is a no-op for an unknown sourceId', () => {
    const manager = new OtpManager();
    expect(() => manager.cancelOtp('does-not-exist')).not.toThrow();
  });
});

describe('hasPendingOtp', () => {
  it('returns true while waiting, false after resolution', async () => {
    const manager = new OtpManager();
    const { emit } = makeEmit();
    const promise = manager.waitForOtp('src-1', emit);
    expect(manager.hasPendingOtp('src-1')).toBe(true);
    manager.submitOtp('src-1', 'otp');
    await promise;
    expect(manager.hasPendingOtp('src-1')).toBe(false);
  });

  it('returns false for an unknown sourceId', () => {
    const manager = new OtpManager();
    expect(manager.hasPendingOtp('nope')).toBe(false);
  });
});

describe('concurrent waitForOtp for different sourceIds', () => {
  it('resolves each independently', async () => {
    const manager = new OtpManager();
    const { emit } = makeEmit();
    const p1 = manager.waitForOtp('src-a', emit);
    const p2 = manager.waitForOtp('src-b', emit);

    manager.submitOtp('src-a', 'otp-for-a');
    await expect(p1).resolves.toBe('otp-for-a');

    manager.submitOtp('src-b', 'otp-for-b');
    await expect(p2).resolves.toBe('otp-for-b');
  });

  it('timing out one does not affect the other', async () => {
    vi.useFakeTimers();
    const manager = new OtpManager();
    const { emit } = makeEmit();
    const p1 = manager.waitForOtp('src-short', emit, 100);
    const p2 = manager.waitForOtp('src-long', emit, 10_000);

    vi.advanceTimersByTime(100);
    await expect(p1).rejects.toBeInstanceOf(OtpTimeoutError);

    manager.submitOtp('src-long', 'still-good');
    await expect(p2).resolves.toBe('still-good');
  });
});
