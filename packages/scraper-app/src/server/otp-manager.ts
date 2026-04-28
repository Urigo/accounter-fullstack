import type { WebSocket } from 'ws';
import type { ServerMessage } from '../shared/ws-protocol.js';

export class OtpTimeoutError extends Error {
  constructor(public readonly sourceId: string) {
    super(`OTP timeout for source "${sourceId}"`);
    this.name = 'OtpTimeoutError';
  }
}

type PendingEntry = {
  resolve: (otp: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingEntry>();

function sendMsg(ws: WebSocket, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

export function waitForOtp(ws: WebSocket, sourceId: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    sendMsg(ws, { type: 'otp-required', sourceId });

    const timer = setTimeout(() => {
      pending.delete(sourceId);
      reject(new OtpTimeoutError(sourceId));
    }, timeoutMs);

    pending.set(sourceId, { resolve, reject, timer });
  });
}

export function submitOtp(sourceId: string, otp: string): void {
  const entry = pending.get(sourceId);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(sourceId);
  entry.resolve(otp);
}

export function cancelOtp(sourceId: string): void {
  const entry = pending.get(sourceId);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(sourceId);
  entry.reject(new OtpTimeoutError(sourceId));
}

/** Clear all pending OTP entries — for use in tests only. */
export function _clearPending(): void {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
  }
  pending.clear();
}
