import '@fastify/websocket'; // type augmentation for app.injectWS
import Fastify, { type FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerWebSocketRoute } from '../websocket.js';

const STUB_VAULT = {
  poalimAccounts: [{ id: 'src-1', userCode: 'u', password: 'p' }],
  discountAccounts: [],
  isracardAccounts: [],
  amexAccounts: [],
  calAccounts: [],
  maxAccounts: [],
  otsarHahayalAccounts: [],
  accountRecords: [],
  settings: { showBrowser: false, fetchBankOfIsraelRates: true, concurrentScraping: false },
};

vi.mock('../vault-store.js', () => ({ isLocked: () => false, getVault: () => STUB_VAULT }));
vi.mock('../scrape-runner.js', () => ({ startRun: vi.fn().mockResolvedValue(undefined) }));

let app: FastifyInstance;

// Buffered message queue: onMessage collects arrivals; next() dequeues or waits.
// Set up via onInit so the listener is active before the connection opens —
// guarantees no message is ever missed regardless of event-loop ordering.
function makeClient() {
  const queue: unknown[] = [];
  const waiters: Array<(m: unknown) => void> = [];

  const onMessage = (data: { toString(): string }) => {
    const msg = JSON.parse(data.toString()) as unknown;
    const resolve = waiters.shift();
    if (resolve) resolve(msg);
    else queue.push(msg);
  };

  const next = (ms = 2000): Promise<unknown> => {
    if (queue.length > 0) return Promise.resolve(queue.shift());
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        const i = waiters.indexOf(res);
        if (i !== -1) waiters.splice(i, 1);
        rej(new Error('timeout waiting for WS message'));
      }, ms);
      waiters.push(m => {
        clearTimeout(t);
        res(m);
      });
    });
  };

  return { onMessage, next };
}

async function openSocket(
  client: ReturnType<typeof makeClient>,
): Promise<WebSocket> {
  return app.injectWS('/ws', undefined, {
    onInit: (w: WebSocket) => w.on('message', client.onMessage),
  });
}

beforeEach(async () => {
  app = Fastify({ logger: false });
  await registerWebSocketRoute(app);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('WebSocket /ws', () => {
  it('sends connected ack immediately on connection', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    expect(await client.next()).toEqual({ type: 'connected' });
    ws.close();
  });

  it('responds to ping with pong', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next(); // consume connected
    ws.send(JSON.stringify({ type: 'ping' }));
    expect(await client.next()).toEqual({ type: 'pong' });
    ws.close();
  });

  it('sends error reply for unknown message type', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next(); // consume connected

    ws.send(JSON.stringify({ type: 'totally-unknown', payload: 42 }));

    expect(await client.next()).toEqual({ type: 'error', message: 'Unknown message type' });
    ws.close();
  });

  it('server stays alive after unknown message type', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next(); // consume connected

    ws.send(JSON.stringify({ type: 'totally-unknown', payload: 42 }));
    await client.next(); // consume error reply

    ws.send(JSON.stringify({ type: 'ping' }));
    expect(await client.next()).toEqual({ type: 'pong' });
    ws.close();
  });

  it('accepts run-start message without crashing (stub handler)', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next(); // consume connected

    ws.send(JSON.stringify({ type: 'run-start', sourceIds: ['src-1'] }));
    ws.send(JSON.stringify({ type: 'ping' }));

    // pong proves the server processed run-start without crashing
    expect(await client.next()).toEqual({ type: 'pong' });
    ws.close();
  });

  it('does not crash on malformed JSON — server stays alive', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next();

    ws.send('this is {{ not valid json');
    ws.send(JSON.stringify({ type: 'ping' }));

    expect(await client.next()).toEqual({ type: 'pong' });
    ws.close();
  });

  it('handles multiple concurrent connections independently', async () => {
    const c1 = makeClient();
    const c2 = makeClient();
    const ws1 = await openSocket(c1);
    const ws2 = await openSocket(c2);

    expect(await c1.next()).toEqual({ type: 'connected' });
    expect(await c2.next()).toEqual({ type: 'connected' });

    ws1.close();
    ws2.close();
  });
});
