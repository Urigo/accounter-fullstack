import { inspect } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLogWriter } from '../../log.js';
import type { SlackConfig } from '../config.js';
import {
  flushNotifications,
  initNotifications,
  noopNotifier,
  notify,
  SlackNotifier,
} from '../notifier.js';
import { Secret } from '../secret.js';
import { captureLogs, fakeFetch, WEBHOOK, webhook } from './helpers.js';

const OTHER = `${WEBHOOK}-events`;

function config(overrides: Partial<SlackConfig> = {}): SlackConfig {
  return {
    alertsWebhookUrl: webhook(),
    eventsWebhookUrl: new Secret(OTHER),
    dedupeWindowSeconds: 300,
    allowNonProd: false,
    problems: [],
    ...overrides,
  };
}

afterEach(() => {
  initNotifications(config({ alertsWebhookUrl: undefined, eventsWebhookUrl: undefined }), {
    envLabel: 'test',
  });
  setLogWriter();
});

describe('initNotifications', () => {
  it('is a no-op until initialised', async () => {
    notify({ type: 'job.failed', title: 'x' });
    expect(await flushNotifications(0)).toEqual({ sent: 0, failed: 0, dropped: 0 });
  });

  it('stays off in development / test unless SLACK_ALLOW_NON_PROD is set', () => {
    captureLogs();
    expect(initNotifications(config(), { envLabel: 'test' })).toBe(noopNotifier);
    expect(initNotifications(config(), { envLabel: 'development' })).toBe(noopNotifier);
    expect(initNotifications(config({ allowNonProd: true }), { envLabel: 'test' })).toBeInstanceOf(
      SlackNotifier,
    );
    expect(initNotifications(config(), { envLabel: 'production' })).toBeInstanceOf(SlackNotifier);
  });

  it('warns which types will not be delivered when only one webhook is set', () => {
    const logs = captureLogs();
    initNotifications(config({ eventsWebhookUrl: undefined }), { envLabel: 'production' });
    expect(logs.records()).toContainEqual(
      expect.objectContaining({
        msg: 'slack-channel-disabled',
        channel: 'events',
        types: ['tenant.created', 'invitation.accepted'],
      }),
    );
  });

  it('logs config problems as warnings without the values', () => {
    const logs = captureLogs();
    initNotifications(config({ problems: ['SLACK_ALERT_MENTION must be …; it is ignored.'] }), {
      envLabel: 'production',
    });
    expect(logs.records()[0]).toMatchObject({ msg: 'slack-config-invalid', level: 'warn' });
    expect(logs.lines.join('')).not.toContain('hooks.slack.com');
  });
});

describe('SlackNotifier', () => {
  it('routes by catalog, mentions on alerts only, and dedupes alerts but not events', async () => {
    const fetch = fakeFetch();
    const notifier = new SlackNotifier(config({ alertMention: '<!here>' }), {
      envLabel: 'production',
      fetch,
    });
    notifier.notify({ type: 'job.failed', title: 'Job failed', fields: { job: 'cleanup' } });
    notifier.notify({ type: 'job.failed', title: 'Job failed', fields: { job: 'cleanup' } });
    notifier.notify({ type: 'tenant.created', title: 'Tenant created', fields: { id: '1' } });
    notifier.notify({ type: 'tenant.created', title: 'Tenant created', fields: { id: '1' } });
    expect(await notifier.flush(5000)).toEqual({ sent: 3, failed: 0, dropped: 0 });

    const sent = fetch.mock.calls.map(([url, init]) => ({
      url,
      text: JSON.parse(String(init?.body)).text as string,
    }));
    expect(sent.filter(s => s.url === WEBHOOK)).toHaveLength(1);
    expect(sent.filter(s => s.url === OTHER)).toHaveLength(2);
    expect(sent.find(s => s.url === WEBHOOK)?.text).toMatch(/^<!here> /);
    expect(sent.find(s => s.url === OTHER)?.text).not.toContain('<!here>');
  });

  it('caps alerts at 20 per minute, then sends one storm message', async () => {
    vi.useFakeTimers();
    try {
      const fetch = fakeFetch();
      const notifier = new SlackNotifier(config(), { envLabel: 'production', fetch });
      for (let i = 0; i < 25; i++) {
        notifier.notify({ type: 'job.failed', title: 'Job failed', fields: { i } });
      }
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await notifier.flush(0)).toEqual({ sent: 21, failed: 0, dropped: 5 });
      const last = JSON.parse(String(fetch.mock.calls.at(-1)![1]?.body)).text as string;
      expect(last).toContain('Alert storm');

      // A new window lets alerts through again.
      await vi.advanceTimersByTimeAsync(60_000);
      notifier.notify({ type: 'job.failed', title: 'Job failed', fields: { i: 'next' } });
      await vi.advanceTimersByTimeAsync(2000);
      expect((await notifier.flush(0)).sent).toBe(22);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not open a dedupe window for an alert the cap dropped', async () => {
    vi.useFakeTimers();
    try {
      const fetch = fakeFetch();
      const notifier = new SlackNotifier(config(), { envLabel: 'production', fetch });
      for (let i = 0; i < 20; i++) {
        notifier.notify({ type: 'graphql.internal-error', title: 'Internal error', fields: { i } });
      }
      const pool = { type: 'db.pool.saturated', title: 'DB pool saturated' } as const;
      notifier.notify(pool); // Capped: replaced by the storm message.
      await vi.advanceTimersByTimeAsync(61_000);
      expect(await notifier.flush(0)).toMatchObject({ sent: 21, dropped: 1 });

      // Well inside the 300 s dedupe window, but no copy has reached Slack yet.
      notifier.notify(pool);
      await vi.advanceTimersByTimeAsync(2000);
      expect((await notifier.flush(0)).sent).toBe(22);
      const text = JSON.stringify(JSON.parse(String(fetch.mock.calls.at(-1)![1]?.body)));
      expect(text).toContain('DB pool saturated');
      expect(text).not.toContain('similar suppressed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shares one queue when both channels use the same webhook', async () => {
    const fetch = fakeFetch();
    const notifier = new SlackNotifier(config({ eventsWebhookUrl: webhook() }), {
      envLabel: 'production',
      fetch,
    });
    notifier.notify({ type: 'job.failed', title: 'a' });
    notifier.notify({ type: 'tenant.created', title: 'b' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    // The second waits for the per-webhook spacing instead of going out in parallel.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await notifier.flush(5000)).toEqual({ sent: 2, failed: 0, dropped: 0 });
  });

  it('never throws, whatever the input or the fetch does', async () => {
    captureLogs();
    const fetch = vi.fn(() => {
      throw new Error('sync');
    });
    const notifier = new SlackNotifier(config(), { envLabel: 'production', fetch });
    expect(() =>
      notifier.notify({ type: 'job.failed', title: 'x', fields: { big: 1n as unknown as number } }),
    ).not.toThrow();
    expect(() => notifier.notify({ type: 'nope' as 'job.failed', title: 'x' })).not.toThrow();
    expect(() => notifier.notify(undefined as never)).not.toThrow();
    await notifier.flush(5000);
  });
});

describe('Secret', () => {
  it('redacts in every serialization', () => {
    const secret = webhook();
    expect(String(secret)).toBe('[REDACTED]');
    expect(JSON.stringify({ secret })).toBe('{"secret":"[REDACTED]"}');
    expect(inspect({ secret })).not.toContain('hooks.slack.com');
    expect(secret.reveal()).toBe(WEBHOOK);
  });
});
