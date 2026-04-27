import type { WebSocket } from 'ws';
import type { RunStartMessage, ServerMessage } from '../shared/ws-protocol.js';
import { getVault } from './vault-store.js';
import type { Vault } from './vault.js';

// ── Stub ─────────────────────────────────────────────────────────────────────

type ScrapeResult = { inserted: number; skipped: number; insertedIds: string[] };

async function runSourceStub(_sourceId: string): Promise<ScrapeResult> {
  await new Promise<void>(r => setTimeout(r, 50));
  return { inserted: 2, skipped: 1, insertedIds: ['a', 'b'] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type SourceRef = { id: string };

function collectSourceRefs(vault: Vault): SourceRef[] {
  return [
    ...vault.poalimAccounts,
    ...vault.discountAccounts,
    ...vault.isracardAccounts,
    ...vault.amexAccounts,
    ...vault.calAccounts,
    ...vault.maxAccounts,
  ];
}

function send(ws: WebSocket, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

// ── State ─────────────────────────────────────────────────────────────────────

let _running = false;

export function isRunning(): boolean {
  return _running;
}

/** Reset run state — for use in tests only. */
export function _resetRunState(): void {
  _running = false;
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function startRun(ws: WebSocket, request: RunStartMessage): Promise<void> {
  if (_running) {
    send(ws, { type: 'run-error', message: 'A run is already in progress' });
    return;
  }

  _running = true;

  try {
    const vault = getVault();
    const allRefs = collectSourceRefs(vault);

    const sources = request.sourceIds
      ? allRefs.filter(s => request.sourceIds!.includes(s.id))
      : allRefs;

    if (sources.length === 0) {
      send(ws, { type: 'run-error', message: 'No matching sources found' });
      return;
    }

    // Announce all tasks as pending before any work begins
    for (const src of sources) {
      send(ws, { type: 'task-pending', sourceId: src.id });
    }

    const runTask = async (sourceId: string): Promise<ScrapeResult> => {
      send(ws, { type: 'task-running', sourceId });
      const result = await runSourceStub(sourceId);
      send(ws, { type: 'task-done', sourceId, ...result });
      return result;
    };

    let results: ScrapeResult[];
    if (vault.settings.concurrentScraping) {
      const settled = await Promise.allSettled(sources.map(s => runTask(s.id)));
      results = settled
        .filter((r): r is PromiseFulfilledResult<ScrapeResult> => r.status === 'fulfilled')
        .map(r => r.value);
    } else {
      results = [];
      for (const src of sources) {
        results.push(await runTask(src.id));
      }
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

    send(ws, { type: 'run-complete', totalInserted, totalSkipped });
  } finally {
    _running = false;
  }
}
