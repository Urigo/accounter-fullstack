import { vi } from 'vitest';
import { setLogWriter } from '../../log.js';
import { Secret } from '../secret.js';
import type { FetchFn } from '../slack-client.js';

/** Built at runtime so no webhook-shaped literal sits in the repo. */
export const WEBHOOK = ['https://hooks.slack.com', 'services', 'T0TEST', 'B0TEST', 'x'.repeat(24)].join(
  '/',
);
export const webhook = () => new Secret(WEBHOOK);

export function respond(status: number, body = status === 200 ? 'ok' : 'error', headers = {}) {
  return new Response(body, { status, headers });
}

export function fakeFetch(...responses: Array<Response | Error>) {
  const queue = [...responses];
  return vi.fn<FetchFn>(async () => {
    const next = queue.shift() ?? respond(200);
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });
}

export function captureLogs() {
  const lines: string[] = [];
  setLogWriter(line => lines.push(line));
  return {
    lines,
    records: () => lines.map(line => JSON.parse(line) as Record<string, unknown>),
  };
}
