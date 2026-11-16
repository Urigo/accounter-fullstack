import { log } from '../log.js';
import type { SlackConfig } from './config.js';
import { formatSlackMessage } from './format.js';
import { createSlackQueue, type QueueStats, type SlackQueue } from './queue.js';
import type { FetchFn } from './slack-client.js';
import { createThrottle } from './throttle.js';
import { NOTIFICATION_CHANNELS, type Channel, type ServerNotification } from './types.js';

export interface Notifier {
  /** Fire-and-forget. Never throws. */
  notify(notification: ServerNotification): void;
  /** Waits (at most `timeoutMs`) for queued messages to be delivered. Never rejects. */
  flush(timeoutMs?: number): Promise<QueueStats>;
}

const EMPTY_STATS: QueueStats = { sent: 0, failed: 0, dropped: 0 };

export const noopNotifier: Notifier = {
  notify() {},
  flush: async () => ({ ...EMPTY_STATS }),
};

export interface SlackNotifierOptions {
  envLabel: string;
  release?: string;
  fetch?: FetchFn;
}

function defaultFingerprint(notification: ServerNotification): string {
  const fields = notification.fields ?? {};
  const parts = Object.keys(fields)
    .sort()
    .map(key => `${key}=${String(fields[key])}`);
  return [notification.type, ...parts].join('|');
}

/** Global cap on alerts sent per minute, on top of the per-fingerprint dedupe. */
const MAX_ALERTS_PER_MINUTE = 20;
const CAP_WINDOW_MS = 60_000;

export class SlackNotifier implements Notifier {
  private readonly queues = new Map<Channel, SlackQueue>();
  private readonly throttle;
  private capWindowStart = Number.NEGATIVE_INFINITY;
  private capCount = 0;
  private capDropped = 0;

  constructor(
    private readonly config: SlackConfig,
    private readonly options: SlackNotifierOptions,
  ) {
    const fetchFn = options.fetch ?? fetch;
    const { alertsWebhookUrl: alerts, eventsWebhookUrl: events } = config;
    if (alerts && events && alerts.equals(events)) {
      // One webhook for both: share one queue, so Slack's per-webhook rate limit is respected.
      const shared = createSlackQueue({ channel: 'alerts+events', url: alerts, fetch: fetchFn });
      this.queues.set('alerts', shared);
      this.queues.set('events', shared);
    } else {
      if (alerts) {
        this.queues.set(
          'alerts',
          createSlackQueue({ channel: 'alerts', url: alerts, fetch: fetchFn }),
        );
      }
      if (events) {
        this.queues.set(
          'events',
          createSlackQueue({ channel: 'events', url: events, fetch: fetchFn }),
        );
      }
    }
    this.throttle = createThrottle({ windowMs: config.dedupeWindowSeconds * 1000 });
  }

  get channels(): Channel[] {
    return [...this.queues.keys()];
  }

  notify(notification: ServerNotification): void {
    try {
      this.sendTo(NOTIFICATION_CHANNELS[notification.type], notification);
    } catch {
      // `sendTo` already swallows; this guards a malformed `type` at runtime.
    }
  }

  /** Sends to an explicit channel, ignoring the catalog. Used by `notify:test`. */
  sendTo(channel: Channel, notification: ServerNotification): void {
    try {
      const queue = this.queues.get(channel);
      if (!queue) {
        return;
      }
      let suppressed = 0;
      if (channel === 'alerts') {
        const decision = this.throttle.check(
          notification.fingerprint ?? defaultFingerprint(notification),
        );
        if (!decision.send) {
          return;
        }
        suppressed = decision.suppressed;
        if (!this.underAlertCap(queue)) {
          return;
        }
      }
      queue.enqueue(
        formatSlackMessage(notification, {
          envLabel: this.options.envLabel,
          release: this.options.release,
          mention: channel === 'alerts' ? this.config.alertMention : undefined,
          suppressed,
        }),
      );
    } catch (error) {
      try {
        log('warn', 'slack-notification-failed', {
          channel,
          type: notification?.type,
          reason: error instanceof Error ? error.name : 'unknown-error',
        });
      } catch {
        // Nothing left to report to.
      }
    }
  }

  /**
   * Fixed one-minute window. The alert that would exceed the cap is replaced by a single "alert
   * storm" message; the rest of the window's alerts are dropped (and counted as dropped).
   */
  private underAlertCap(queue: SlackQueue): boolean {
    const now = Date.now();
    if (now - this.capWindowStart >= CAP_WINDOW_MS) {
      this.capWindowStart = now;
      this.capCount = 0;
    }
    this.capCount++;
    if (this.capCount <= MAX_ALERTS_PER_MINUTE) {
      return true;
    }
    if (this.capCount === MAX_ALERTS_PER_MINUTE + 1) {
      queue.enqueue(
        formatSlackMessage(
          {
            type: 'notifications.alert-storm',
            title: 'Alert storm: further alerts suppressed',
            fields: {
              maxPerMinute: MAX_ALERTS_PER_MINUTE,
              resumesAt: new Date(this.capWindowStart + CAP_WINDOW_MS).toISOString(),
            },
          },
          {
            envLabel: this.options.envLabel,
            release: this.options.release,
            mention: this.config.alertMention,
          },
        ),
      );
    }
    this.capDropped++;
    return false;
  }

  async flush(timeoutMs = 5000): Promise<QueueStats> {
    const total = { ...EMPTY_STATS, dropped: this.capDropped };
    try {
      const results = await Promise.all(
        [...new Set(this.queues.values())].map(queue => queue.flush(timeoutMs)),
      );
      for (const stats of results) {
        total.sent += stats.sent;
        total.failed += stats.failed;
        total.dropped += stats.dropped;
      }
    } catch {
      // Queues never reject; keep the promise contract anyway.
    }
    return total;
  }
}

/** Environment labels where Slack stays off unless `SLACK_ALLOW_NON_PROD=1`. */
const NON_PROD_LABELS = new Set(['development', 'dev', 'test', 'local']);

let current: Notifier = noopNotifier;

/**
 * Sends a notification through the notifier installed by `initNotifications()` (a no-op until
 * then, and in development / test). Never throws.
 */
export function notify(notification: ServerNotification): void {
  try {
    current.notify(notification);
  } catch {
    // A notification must never break the code path that sent it.
  }
}

export function flushNotifications(timeoutMs?: number): Promise<QueueStats> {
  return current.flush(timeoutMs).catch(() => ({ ...EMPTY_STATS }));
}

/**
 * Installs the process-wide notifier from the parsed `SLACK_*` config. Called once from `main()`;
 * invalid variables are logged here (fail-open) rather than stopping the server.
 */
export function initNotifications(config: SlackConfig, options: SlackNotifierOptions): Notifier {
  for (const problem of config.problems) {
    log('warn', 'slack-config-invalid', { problem });
  }
  current = noopNotifier;
  if (!config.alertsWebhookUrl && !config.eventsWebhookUrl) {
    return current;
  }
  if (NON_PROD_LABELS.has(options.envLabel.toLowerCase()) && !config.allowNonProd) {
    log('info', 'slack-notifications-disabled', {
      reason: 'non-production',
      envLabel: options.envLabel,
    });
    return current;
  }
  for (const [channel, url] of [
    ['alerts', config.alertsWebhookUrl],
    ['events', config.eventsWebhookUrl],
  ] as const) {
    if (!url) {
      log('warn', 'slack-channel-disabled', {
        channel,
        types: Object.entries(NOTIFICATION_CHANNELS)
          .filter(([, target]) => target === channel)
          .map(([type]) => type),
      });
    }
  }
  const notifier = new SlackNotifier(config, options);
  current = notifier;
  log('info', 'slack-notifications-enabled', { channels: notifier.channels });
  return current;
}
