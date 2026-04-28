import '@fastify/websocket';
import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetRunState, _setStubDataOverride } from '../scrape-runner.js';
import { defaultVault, saveVaultFile } from '../vault.js';
import { lockVault, unlockVault, updateVault } from '../vault-store.js';
import { registerWebSocketRoute } from '../websocket.js';

const PASSWORD = 'test-password-123';
const SRC_1 = 'src-poalim-1';
const SRC_2 = 'src-max-2';

let vaultPath: string;
let app: FastifyInstance;

// ── Buffered WS client (same pattern as websocket.test.ts) ───────────────────

function makeClient() {
  const queue: unknown[] = [];
  const waiters: Array<(m: unknown) => void> = [];

  const onMessage = (data: { toString(): string }) => {
    const msg = JSON.parse(data.toString()) as unknown;
    const resolve = waiters.shift();
    if (resolve) resolve(msg);
    else queue.push(msg);
  };

  const next = (ms = 3000): Promise<unknown> => {
    if (queue.length > 0) return Promise.resolve(queue.shift());
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        const i = waiters.indexOf(res);
        if (i !== -1) waiters.splice(i, 1);
        rej(new Error('timeout waiting for WS message'));
      }, ms);
      waiters.push(m => { clearTimeout(t); res(m); });
    });
  };

  // Collect all messages up to and including the first `run-complete` or `run-error`.
  const collectRun = async (): Promise<unknown[]> => {
    const msgs: unknown[] = [];
    for (;;) {
      const msg = await next();
      msgs.push(msg);
      const type = (msg as { type: string }).type;
      if (type === 'run-complete' || type === 'run-error') break;
    }
    return msgs;
  };

  return { onMessage, next, collectRun };
}

async function openSocket(client: ReturnType<typeof makeClient>): Promise<WebSocket> {
  return app.injectWS('/ws', undefined, {
    onInit: (w: WebSocket) => w.on('message', client.onMessage),
  });
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(async () => {
  vaultPath = join(tmpdir(), `scrape-runner-${randomBytes(4).toString('hex')}.vault`);
  process.env['VAULT_FILE'] = vaultPath;

  const vault = defaultVault();
  vault.poalimAccounts.push({ id: SRC_1, userCode: 'u1', password: 'p1' });
  vault.maxAccounts.push({ id: SRC_2, username: 'mxu', password: 'p2' });
  // Poalim stub returns accountNumber 100000; register it so sources aren't blocked by default.
  vault.bankAccounts.push({
    id: 'ba-p1',
    sourceId: SRC_1,
    sourceType: 'poalim',
    accountNumber: '100000',
    status: 'accepted',
  });
  await saveVaultFile(vaultPath, vault, PASSWORD);

  await unlockVault(PASSWORD);

  app = Fastify({ logger: false });
  await registerWebSocketRoute(app);
  await app.ready();
});

afterEach(async () => {
  _resetRunState();
  _setStubDataOverride(null);
  lockVault();
  await app.close();
  await rm(vaultPath, { force: true });
  delete process.env['VAULT_FILE'];
});

// ── Concurrent mode ───────────────────────────────────────────────────────────

describe('concurrent mode (default)', () => {
  it('emits task-pending×2 → task-running×2 → task-done×2 → run-complete', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next(); // consume connected

    ws.send(JSON.stringify({ type: 'run-start', sourceIds: [SRC_1, SRC_2] }));
    const msgs = await client.collectRun();

    expect(msgs).toHaveLength(7);

    // First two must be task-pending (sent before any work begins)
    expect(msgs[0]).toEqual({ type: 'task-pending', sourceId: SRC_1 });
    expect(msgs[1]).toEqual({ type: 'task-pending', sourceId: SRC_2 });

    // Next two: both task-running (concurrent, order matches Promise.all arg order)
    expect(msgs[2]).toMatchObject({ type: 'task-running', sourceId: SRC_1 });
    expect(msgs[3]).toMatchObject({ type: 'task-running', sourceId: SRC_2 });

    // Next two: both task-done
    expect(msgs[4]).toMatchObject({
      type: 'task-done',
      sourceId: SRC_1,
      inserted: 2,
      skipped: 1,
      insertedIds: ['a', 'b'],
    });
    expect(msgs[5]).toMatchObject({ type: 'task-done', sourceId: SRC_2 });

    // Final: run-complete with summed totals
    expect(msgs[6]).toEqual({ type: 'run-complete', totalInserted: 4, totalSkipped: 2 });

    ws.close();
  });

  it('uses all vault sources when sourceIds is omitted', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next();

    ws.send(JSON.stringify({ type: 'run-start' }));
    const msgs = await client.collectRun();

    const pendings = msgs.filter((m: unknown) => (m as { type: string }).type === 'task-pending');
    expect(pendings).toHaveLength(2);
    expect(msgs.at(-1)).toMatchObject({ type: 'run-complete' });

    ws.close();
  });

  it('in-progress guard: second run-start returns run-error immediately', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next(); // connected

    // Fire first run (SRC_1 only), then immediately a second run.
    ws.send(JSON.stringify({ type: 'run-start', sourceIds: [SRC_1] }));
    ws.send(JSON.stringify({ type: 'run-start', sourceIds: [SRC_2] }));

    // Sequence produced:
    //  task-pending SRC_1  ← sync, before first run yields
    //  task-running SRC_1  ← sync, inside runTask before stub await
    //  run-error           ← sync rejection of second run (fires after first yields)
    //  task-done SRC_1     ← async, 50 ms later
    //  run-complete        ← async
    const all: Array<{ type: string }> = [];
    for (let i = 0; i < 5; i++) {
      all.push((await client.next()) as { type: string });
    }
    const types = all.map(m => m.type);

    expect(types.filter(t => t === 'run-error')).toHaveLength(1);
    expect(types.filter(t => t === 'run-complete')).toHaveLength(1);
    // run-error must arrive before run-complete (rejected synchronously, run 1 still in progress)
    expect(types.indexOf('run-error')).toBeLessThan(types.indexOf('run-complete'));
    // first message is from the accepted run, not the rejected one
    expect(all[0]).toMatchObject({ type: 'task-pending', sourceId: SRC_1 });

    ws.close();
  });
});

// ── Sequential mode ───────────────────────────────────────────────────────────

describe('sequential mode (concurrentScraping: false)', () => {
  beforeEach(async () => {
    await updateVault(v => ({
      ...v,
      settings: { ...v.settings, concurrentScraping: false },
    }));
  });

  it('emits task-pending×2 → task-running→task-done interleaved → run-complete', async () => {
    const client = makeClient();
    const ws = await openSocket(client);
    await client.next();

    ws.send(JSON.stringify({ type: 'run-start', sourceIds: [SRC_1, SRC_2] }));
    const msgs = await client.collectRun();

    expect(msgs).toHaveLength(7);

    // Both pendings first
    expect(msgs[0]).toMatchObject({ type: 'task-pending', sourceId: SRC_1 });
    expect(msgs[1]).toMatchObject({ type: 'task-pending', sourceId: SRC_2 });

    // Sequential: running→done for each source in order
    expect(msgs[2]).toMatchObject({ type: 'task-running', sourceId: SRC_1 });
    expect(msgs[3]).toMatchObject({ type: 'task-done', sourceId: SRC_1 });
    expect(msgs[4]).toMatchObject({ type: 'task-running', sourceId: SRC_2 });
    expect(msgs[5]).toMatchObject({ type: 'task-done', sourceId: SRC_2 });

    expect(msgs[6]).toEqual({ type: 'run-complete', totalInserted: 4, totalSkipped: 2 });

    ws.close();
  });
});

// ── Blocked path ──────────────────────────────────────────────────────────────

describe('task-blocked path', () => {
  it('emits task-blocked + scrape-progress blocked when account is unknown', async () => {
    // Remove bankAccounts so poalim account 100000 is unrecognised
    await updateVault(v => ({ ...v, bankAccounts: [] }));

    const client = makeClient();
    const ws = await openSocket(client);
    await client.next(); // connected

    ws.send(JSON.stringify({ type: 'run-start', sourceIds: [SRC_1] }));
    const msgs = await client.collectRun();

    expect(msgs).toHaveLength(5);
    expect(msgs[0]).toEqual({ type: 'task-pending', sourceId: SRC_1 });
    expect(msgs[1]).toMatchObject({ type: 'task-running', sourceId: SRC_1 });
    expect(msgs[2]).toMatchObject({
      type: 'task-blocked',
      sourceId: SRC_1,
      sourceType: 'poalim',
      unknownAccounts: ['100000'],
    });
    expect(msgs[3]).toMatchObject({ type: 'scrape-progress', sourceId: SRC_1, status: 'blocked' });
    expect(msgs[4]).toEqual({ type: 'run-complete', totalInserted: 0, totalSkipped: 0 });

    ws.close();
  });
});

// ── Payload validation error path ─────────────────────────────────────────────

describe('payload validation error path', () => {
  it('emits scrape-progress error when stub data fails schema validation', async () => {
    _setStubDataOverride(() => ({ completely: 'wrong', shape: true }));

    const client = makeClient();
    const ws = await openSocket(client);
    await client.next(); // connected

    ws.send(JSON.stringify({ type: 'run-start', sourceIds: [SRC_1] }));
    const msgs = await client.collectRun();

    expect(msgs).toHaveLength(4);
    expect(msgs[0]).toEqual({ type: 'task-pending', sourceId: SRC_1 });
    expect(msgs[1]).toMatchObject({ type: 'task-running', sourceId: SRC_1 });
    expect(msgs[2]).toMatchObject({
      type: 'scrape-progress',
      sourceId: SRC_1,
      sourceType: 'poalim',
      status: 'error',
    });
    expect(msgs[3]).toMatchObject({ type: 'run-complete' });

    ws.close();
  });
});
