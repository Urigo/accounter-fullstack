import { log } from '../log.js';
import type { SlackMessage } from './format.js';
import type { Secret } from './secret.js';
import { postSlackMessage, type FetchFn, type SlackPostResult } from './slack-client.js';

export interface QueueStats {
  sent: number;
  failed: number;
  dropped: number;
}

export interface SlackQueue {
  enqueue(message: SlackMessage): void;
  /** Resolves when the queue is empty or `timeoutMs` has passed, whichever comes first. */
  flush(timeoutMs: number): Promise<QueueStats>;
}

export interface SlackQueueOptions {
  /** For log lines only (`alerts`, `events`, `alerts+events`). */
  channel: string;
  url: Secret;
  fetch: FetchFn;
  maxSize?: number;
  /** Slack allows about one message per second per webhook. */
  spacingMs?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

const MAX_RETRY_AFTER_MS = 5000;
const CIRCUIT_MS = 15 * 60 * 1000;
/** The webhook was revoked or its channel archived: retrying will not help. */
const PERMANENT_STATUSES = new Set([403, 404, 410]);

function isRetryable(result: SlackPostResult): boolean {
  return (
    !result.ok && (result.status === undefined || result.status === 429 || result.status >= 500)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * A bounded, single-flight delivery queue for one webhook URL. Nothing here throws or rejects:
 * failures are counted and logged (without the URL), and the notifier never notifies about itself.
 */
export function createSlackQueue(options: SlackQueueOptions): SlackQueue {
  const {
    channel,
    url,
    fetch: fetchFn,
    maxSize = 100,
    spacingMs = 1100,
    retryDelayMs = 1000,
    timeoutMs = 3000,
  } = options;
  const items: SlackMessage[] = [];
  const stats: QueueStats = { sent: 0, failed: 0, dropped: 0 };
  let running: Promise<void> | undefined;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let circuitOpenUntil = 0;
  let overflowing = false;

  function start(): void {
    running ??= pump()
      .catch(() => {})
      .finally(() => {
        running = undefined;
        // An item enqueued while the pump was winding down would otherwise be stranded.
        if (items.length > 0) {
          start();
        }
      });
  }

  async function pump(): Promise<void> {
    while (items.length > 0) {
      const wait = lastSentAt + spacingMs - Date.now();
      if (wait > 0) {
        await sleep(wait);
      }
      const message = items.shift()!;
      if (Date.now() < circuitOpenUntil) {
        stats.dropped++;
        continue;
      }
      await deliver(message);
    }
    overflowing = false;
  }

  async function deliver(message: SlackMessage): Promise<void> {
    let result = await postSlackMessage(fetchFn, url, message, timeoutMs);
    if (isRetryable(result)) {
      const delay =
        !result.ok && result.status === 429
          ? Math.min(result.retryAfterMs ?? retryDelayMs, MAX_RETRY_AFTER_MS)
          : retryDelayMs;
      await sleep(delay);
      result = await postSlackMessage(fetchFn, url, message, timeoutMs);
    }
    lastSentAt = Date.now();
    if (result.ok) {
      stats.sent++;
      return;
    }
    stats.failed++;
    if (result.status !== undefined && PERMANENT_STATUSES.has(result.status)) {
      circuitOpenUntil = Date.now() + CIRCUIT_MS;
      stats.dropped += items.length;
      items.length = 0;
      log('warn', 'slack-webhook-rejected', {
        channel,
        status: result.status,
        reason: result.reason,
        pausedMinutes: CIRCUIT_MS / 60_000,
      });
      return;
    }
    log('warn', 'slack-notification-failed', {
      channel,
      status: result.status,
      reason: result.reason,
    });
  }

  return {
    enqueue(message) {
      if (Date.now() < circuitOpenUntil) {
        stats.dropped++;
        return;
      }
      if (items.length >= maxSize) {
        stats.dropped++;
        if (!overflowing) {
          overflowing = true;
          log('warn', 'slack-notification-dropped', { channel, reason: 'queue-full', maxSize });
        }
        return;
      }
      items.push(message);
      start();
    },

    async flush(flushTimeoutMs) {
      const deadline = Date.now() + flushTimeoutMs;
      while (running && Date.now() < deadline) {
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<void>(resolve => {
          timer = setTimeout(resolve, deadline - Date.now());
        });
        await Promise.race([running, timeout]);
        clearTimeout(timer);
      }
      return { ...stats };
    },
  };
}
