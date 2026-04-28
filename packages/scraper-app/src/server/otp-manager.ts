import type { ServerMessage } from '../shared/ws-protocol.js';

export class OtpTimeoutError extends Error {
  constructor(public readonly sourceId: string) {
    super(`OTP timeout for source "${sourceId}"`);
    this.name = 'OtpTimeoutError';
  }
}

export class OtpCancelledError extends Error {
  constructor(public readonly sourceId: string) {
    super(`OTP cancelled for source "${sourceId}"`);
    this.name = 'OtpCancelledError';
  }
}

type PendingEntry = {
  resolve: (otp: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class OtpManager {
  private readonly pending = new Map<string, PendingEntry>();

  waitForOtp(
    sourceId: string,
    emit: (msg: ServerMessage) => void,
    timeoutMs = 120_000,
  ): Promise<string> {
    this.cancelOtp(sourceId);
    return new Promise((resolve, reject) => {
      emit({ type: 'otp-required', sourceId });

      const timer = setTimeout(() => {
        this.pending.delete(sourceId);
        reject(new OtpTimeoutError(sourceId));
      }, timeoutMs);

      this.pending.set(sourceId, { resolve, reject, timer });
    });
  }

  submitOtp(sourceId: string, otp: string): void {
    const entry = this.pending.get(sourceId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(sourceId);
    entry.resolve(otp);
  }

  cancelOtp(sourceId: string): void {
    const entry = this.pending.get(sourceId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(sourceId);
    entry.reject(new OtpCancelledError(sourceId));
  }

  hasPendingOtp(sourceId: string): boolean {
    return this.pending.has(sourceId);
  }
}
