import type { SlackMessage } from './format.js';
import type { Secret } from './secret.js';

export type FetchFn = typeof fetch;

export type SlackPostResult =
  { ok: true } | { ok: false; status?: number; retryAfterMs?: number; reason: string };

/**
 * One POST to an incoming webhook. Never throws and never rejects: every failure (including a
 * `fetch` that throws synchronously) comes back as `{ ok: false }`. The result never contains the
 * URL.
 */
export async function postSlackMessage(
  fetchFn: FetchFn,
  url: Secret,
  message: SlackMessage,
  timeoutMs = 3000,
): Promise<SlackPostResult> {
  try {
    const res = await fetchFn(url.reveal(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Always drain the body so the connection is released; Slack answers in plain text (`ok`).
    const body = (await res.text()).slice(0, 100);
    if (res.status === 200) {
      return { ok: true };
    }
    const retryAfter = res.headers.get('retry-after');
    const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    return {
      ok: false,
      status: res.status,
      retryAfterMs: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined,
      reason: body || `http-${res.status}`,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.name : 'unknown-error' };
  }
}
