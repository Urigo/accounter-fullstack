import type { WebSocket } from 'ws';
import type { SourceType } from '../shared/source-types.js';
import type { RunStartMessage, ServerMessage } from '../shared/ws-protocol.js';
import { waitForOtp } from './otp-manager.js';
import { scrapePoalim } from './scrapers/poalim.js';
import { checkAccounts } from './check-accounts.js';
import type { ValidatedPayload } from './check-accounts.js';
import { PayloadValidationError, validatePayload } from './validate-payload.js';
import type { PayloadType } from './validate-payload.js';
import { getVault } from './vault-store.js';
import type { Vault } from './vault.js';

// ── Types ─────────────────────────────────────────────────────────────────────

type ScrapeResult = { inserted: number; skipped: number; insertedIds: string[] };

type SourceRef = { id: string; type: SourceType };

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function collectSourceRefs(vault: Vault): SourceRef[] {
  return [
    ...vault.poalimAccounts.map(a => ({ id: a.id, type: 'poalim' as const })),
    ...vault.discountAccounts.map(a => ({ id: a.id, type: 'discount' as const })),
    ...vault.isracardAccounts.map(a => ({ id: a.id, type: 'isracard' as const })),
    ...vault.amexAccounts.map(a => ({ id: a.id, type: 'amex' as const })),
    ...vault.calAccounts.map(a => ({ id: a.id, type: 'cal' as const })),
    ...vault.maxAccounts.map(a => ({ id: a.id, type: 'max' as const })),
  ];
}

function makeStubData(type: SourceType): { payloadType: PayloadType; data: unknown } {
  switch (type) {
    case 'poalim':
      return {
        payloadType: 'poalim-ils',
        data: {
          transactions: [
            {
              activityDescription: 'Credit',
              activityTypeCode: 1,
              eventAmount: 1000,
              eventDate: 20_240_101,
              serialNumber: 1,
              transactionType: 'REGULAR',
              currentBalance: 5000,
              referenceNumber: 12_345,
            },
          ],
          retrievalTransactionData: { accountNumber: 100_000, branchNumber: 600, bankNumber: 12 },
        },
      };
    case 'discount':
      return {
        payloadType: 'discount',
        data: {
          CurrentAccountLastTransactions: {
            CurrentAccountInfo: { AccountBalance: 5000, AccountCurrencyCode: 'ILS' },
            OperationEntry: [
              {
                OperationDate: '2024-01-01',
                ValueDate: '2024-01-01',
                OperationDescription: 'Credit',
                OperationAmount: 1000,
                BalanceAfterOperation: 5000,
                OperationNumber: 1,
              },
            ],
          },
        },
      };
    case 'isracard':
    case 'amex':
      return {
        payloadType: type,
        data: {
          Header: { Status: '1', Message: null },
          CardsTransactionsListBean: {
            Index0: { '@AllCards': 'AllCards', CurrentCardTransactions: [] },
          },
        },
      };
    case 'cal':
      return {
        payloadType: 'cal',
        data: { result: { bankAccounts: [] }, statusCode: 1, statusDescription: 'OK' },
      };
    case 'max':
      return {
        payloadType: 'max',
        data: { result: { transactions: [] }, returnCode: 0 },
      };
  }
}

// For tests: override the raw data returned for a given source type
let _stubDataOverride: ((type: SourceType) => unknown) | null = null;
export function _setStubDataOverride(fn: ((type: SourceType) => unknown) | null): void {
  _stubDataOverride = fn;
}

async function runSourceStub(source: SourceRef): Promise<ValidatedPayload> {
  await new Promise<void>(r => setTimeout(r, 50));
  const stub = makeStubData(source.type);
  const raw = _stubDataOverride ? _stubDataOverride(source.type) : stub.data;
  return validatePayload(stub.payloadType, raw) as ValidatedPayload;
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

    const emitter = (msg: ServerMessage) => send(ws, msg);
    const otpManager = {
      waitForOtp: (sourceId: string, timeoutMs: number) => waitForOtp(ws, sourceId, timeoutMs),
    };
    const now = new Date();
    const dateFrom = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

    const runTask = async (source: SourceRef): Promise<ScrapeResult> => {
      send(ws, { type: 'task-running', sourceId: source.id });
      try {
        let payload: ValidatedPayload;
        if (source.type === 'poalim') {
          const creds = vault.poalimAccounts.find(a => a.id === source.id);
          if (!creds) throw new Error(`Poalim account ${source.id} not found in vault`);
          payload = await scrapePoalim(creds, dateFrom, now, otpManager, emitter);
        } else {
          payload = await runSourceStub(source);
        }
        const check = checkAccounts(source.type, payload, vault.bankAccounts);
        if (check.unknown.length > 0) {
          send(ws, {
            type: 'task-blocked',
            sourceId: source.id,
            sourceType: source.type,
            unknownAccounts: check.unknown,
          });
          send(ws, {
            type: 'scrape-progress',
            sourceId: source.id,
            sourceType: source.type,
            status: 'blocked',
          });
          return { inserted: 0, skipped: 0, insertedIds: [] };
        }
        const result: ScrapeResult = { inserted: 2, skipped: 1, insertedIds: ['a', 'b'] };
        send(ws, { type: 'task-done', sourceId: source.id, ...result });
        return result;
      } catch (e) {
        const error =
          e instanceof PayloadValidationError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e);
        send(ws, {
          type: 'scrape-progress',
          sourceId: source.id,
          sourceType: source.type,
          status: 'error',
          error,
        });
        return { inserted: 0, skipped: 0, insertedIds: [] };
      }
    };

    let results: ScrapeResult[];
    if (vault.settings.concurrentScraping) {
      const settled = await Promise.allSettled(sources.map(s => runTask(s)));
      results = settled
        .filter((r): r is PromiseFulfilledResult<ScrapeResult> => r.status === 'fulfilled')
        .map(r => r.value);
    } else {
      results = [];
      for (const src of sources) {
        results.push(await runTask(src));
      }
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

    send(ws, { type: 'run-complete', totalInserted, totalSkipped });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    send(ws, { type: 'error', message });
  } finally {
    _running = false;
  }
}
