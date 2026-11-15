import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLogWriter } from '../../log.js';
import type { SlackMessage } from '../format.js';
import { createSlackQueue } from '../queue.js';
import { captureLogs, fakeFetch, respond, WEBHOOK, webhook } from './helpers.js';

const message = (text: string): SlackMessage => ({ text, blocks: [] });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  setLogWriter();
});

function queueWith(fetch: ReturnType<typeof fakeFetch>, maxSize?: number) {
  return createSlackQueue({ channel: 'alerts', url: webhook(), fetch, maxSize });
}

describe('createSlackQueue', () => {
  it('posts JSON without following redirects, and spaces sends at least 1.1 s apart', async () => {
    const fetch = fakeFetch();
    const queue = queueWith(fetch);
    queue.enqueue(message('one'));
    queue.enqueue(message('two'));

    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(WEBHOOK);
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(init?.body))).toEqual(message('one'));

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await queue.flush(0)).toEqual({ sent: 2, failed: 0, dropped: 0 });
  });

  it('retries a 429 once after Retry-After (clamped to 5 s)', async () => {
    const fetch = fakeFetch(respond(429, 'rate_limited', { 'Retry-After': '30' }), respond(200));
    const queue = queueWith(fetch);
    queue.enqueue(message('x'));
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await queue.flush(0)).toEqual({ sent: 1, failed: 0, dropped: 0 });
  });

  it('retries a 5xx or network failure once, then logs the failure', async () => {
    const logs = captureLogs();
    const fetch = fakeFetch(respond(500), new TypeError('fetch failed'));
    const queue = queueWith(fetch);
    queue.enqueue(message('x'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await queue.flush(0)).toEqual({ sent: 0, failed: 1, dropped: 0 });
    expect(logs.records()).toEqual([
      expect.objectContaining({ msg: 'slack-notification-failed', channel: 'alerts' }),
    ]);
  });

  it('opens a circuit on 404 and drops later messages, with one warning', async () => {
    const logs = captureLogs();
    const fetch = fakeFetch(respond(404, 'no_service'));
    const queue = queueWith(fetch);
    queue.enqueue(message('a'));
    queue.enqueue(message('b'));
    await vi.advanceTimersByTimeAsync(0);
    queue.enqueue(message('c'));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await queue.flush(0)).toEqual({ sent: 0, failed: 1, dropped: 2 });
    expect(logs.records()).toEqual([
      expect.objectContaining({ msg: 'slack-webhook-rejected', status: 404 }),
    ]);

    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    queue.enqueue(message('d'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('drops beyond maxSize with a single warning', async () => {
    const logs = captureLogs();
    const fetch = fakeFetch();
    const queue = queueWith(fetch, 3);
    for (let i = 0; i < 10; i++) {
      queue.enqueue(message(String(i)));
    }
    // One is in flight, three wait, six are dropped.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await queue.flush(0)).toEqual({ sent: 4, failed: 0, dropped: 6 });
    expect(logs.records().filter(r => r.msg === 'slack-notification-dropped')).toHaveLength(1);
  });

  it('survives a fetch that throws synchronously, and never logs the URL', async () => {
    const logs = captureLogs();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const fetch = vi.fn(() => {
        throw new Error(`boom ${WEBHOOK}`);
      });
      const queue = createSlackQueue({ channel: 'alerts', url: webhook(), fetch });
      queue.enqueue(message('x'));
      await vi.advanceTimersByTimeAsync(5000);
      expect(await queue.flush(0)).toEqual({ sent: 0, failed: 1, dropped: 0 });
      expect(unhandled).not.toHaveBeenCalled();
      expect(logs.lines.join('')).not.toContain('hooks.slack.com');
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('flush resolves once the queue drains, or at the timeout', async () => {
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    const queue = createSlackQueue({ channel: 'alerts', url: webhook(), fetch });
    queue.enqueue(message('x'));
    const flushed = vi.fn();
    void queue.flush(1000).then(flushed);
    await vi.advanceTimersByTimeAsync(999);
    expect(flushed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(flushed).toHaveBeenCalledWith({ sent: 0, failed: 0, dropped: 0 });
  });
});
