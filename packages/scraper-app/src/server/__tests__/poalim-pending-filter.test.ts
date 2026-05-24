import '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HapoalimForeignTransactionsPersonal,
  HapoalimILSTransactions,
} from '@accounter/modern-poalim-scraper';

// ── Module mocks (must be at top level, before any imports of the modules) ─────

const ACCOUNT_REF = { bankNumber: 12, branchNumber: 600, accountNumber: 123456 };

let capturedIlsPayload: HapoalimILSTransactions | null = null;
let capturedForeignPayload: HapoalimForeignTransactionsPersonal | null = null;

const UPLOAD_RESULT = {
  inserted: 0,
  skipped: 0,
  insertedIds: [],
  insertedTransactions: [],
  changedTransactions: [],
};

vi.mock('../graphql/client.js', () => ({
  createUploadClient: () => ({
    uploadPoalimIls: async (payload: HapoalimILSTransactions) => {
      capturedIlsPayload = payload;
      return { ...UPLOAD_RESULT, inserted: payload.transactions?.length ?? 0 };
    },
    uploadPoalimForeign: async (payload: HapoalimForeignTransactionsPersonal) => {
      capturedForeignPayload = payload;
      const count = payload.balancesAndLimitsDataList.reduce(
        (s, e) => s + e.transactions.length,
        0,
      );
      return { ...UPLOAD_RESULT, inserted: count };
    },
    uploadPoalimSwift: async () => UPLOAD_RESULT,
  }),
}));

// scrapePoalim mock: default returns an empty array; overridden per test via scrapePoalimImpl
let scrapePoalimImpl: () => Promise<unknown[]> = async () => [];

vi.mock('../scrapers/poalim.js', () => ({
  scrapePoalim: (...args: unknown[]) => scrapePoalimImpl(),
}));

vi.mock('../account-discovery.js', () => ({
  registerDiscoveredAccounts: async () => undefined,
}));

vi.mock('../check-accounts.js', () => ({
  checkAccounts: () => ({ unknown: [], accepted: [] }),
}));

vi.mock('../history.js', () => ({
  appendRun: async () => undefined,
}));

vi.mock('../otp-manager.js', () => ({
  OtpManager: class {
    waitForOtp() {
      return Promise.resolve('');
    }
    submitOtp() {}
  },
}));

const STUB_VAULT = {
  poalimAccounts: [{ id: 'src-1', userCode: 'u', password: 'p', options: {} }],
  discountAccounts: [],
  isracardAccounts: [],
  amexAccounts: [],
  calAccounts: [],
  maxAccounts: [],
  otsarHahayalAccounts: [],
  accountRecords: [
    {
      sourceType: 'poalim',
      sourceId: 'src-1',
      accountIdentifier: `${ACCOUNT_REF.branchNumber}-${ACCOUNT_REF.accountNumber}`,
      status: 'accepted',
    },
  ],
  settings: {
    showBrowser: false,
    fetchBankOfIsraelRates: false,
    concurrentScraping: false,
    serverUrl: 'http://localhost:4000/graphql',
    apiKey: 'test-key',
  },
};

vi.mock('../vault-store.js', () => ({
  isLocked: () => false,
  getVault: () => STUB_VAULT,
}));

// ── Import under test (after mocks are registered) ────────────────────────────

import { registerWebSocketRoute } from '../websocket.js';

// ── Payload factories ──────────────────────────────────────────────────────────

function makeIlsPayload(types: Array<'REGULAR' | 'TODAY' | 'FUTURE'>): HapoalimILSTransactions {
  return {
    retrievalTransactionData: ACCOUNT_REF as HapoalimILSTransactions['retrievalTransactionData'],
    transactions: types.map((transactionType, i) => ({
      transactionType,
      activityDescription: `txn-${i}`,
      activityTypeCode: 1,
      eventAmount: 100,
      eventDate: 20240101,
      serialNumber: i + 1,
      currentBalance: 5000,
      referenceNumber: 1000 + i,
    })) as HapoalimILSTransactions['transactions'],
  } as HapoalimILSTransactions;
}

function makeForeignPayload(
  currencyTypes: Array<{ currency: string; types: string[] }>,
): HapoalimForeignTransactionsPersonal {
  return {
    balancesAndLimitsDataList: currencyTypes.map(({ currency, types }) => ({
      currencySwiftCode: currency,
      currencyCode: 1,
      transactions: types.map((transactionType, i) => ({
        transactionType,
        activityDescription: `foreign-txn-${i}`,
        activityTypeCode: 1,
        eventAmount: 50,
        currencySwiftCode: currency,
        currencyRate: 3.7,
        currentBalance: 1000,
        referenceNumber: 2000 + i,
      })),
    })),
  } as unknown as HapoalimForeignTransactionsPersonal;
}

// ── Test infra ─────────────────────────────────────────────────────────────────

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
      waiters.push(m => {
        clearTimeout(t);
        res(m);
      });
    });
  };

  const drain = async (ms = 300): Promise<unknown[]> => {
    const msgs: unknown[] = [];
    while (true) {
      try {
        msgs.push(await next(ms));
      } catch {
        break;
      }
    }
    return msgs;
  };

  return { onMessage, next, drain };
}

async function openSocket(client: ReturnType<typeof makeClient>): Promise<WebSocket> {
  return app.injectWS('/ws', undefined, {
    onInit: (w: WebSocket) => w.on('message', client.onMessage),
  });
}

let app: FastifyInstance;

beforeEach(async () => {
  capturedIlsPayload = null;
  capturedForeignPayload = null;
  app = Fastify({ logger: false });
  await registerWebSocketRoute(app);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function runScrape(
  ilsPayload: HapoalimILSTransactions | null,
  foreignPayload: HapoalimForeignTransactionsPersonal | null,
): Promise<unknown[]> {
  scrapePoalimImpl = async () => [
    { ils: ilsPayload, foreign: foreignPayload, swift: null, bankAccount: ACCOUNT_REF },
  ];

  const client = makeClient();
  const ws = await openSocket(client);
  await client.next(); // consume 'connected'
  ws.send(JSON.stringify({ type: 'run-start', sourceIds: ['src-1'] }));
  const msgs = await client.drain();
  ws.close();
  return msgs;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Poalim pending transaction filter', () => {
  describe('ILS transactions', () => {
    it('does not pass TODAY transactions to the upload client', async () => {
      await runScrape(makeIlsPayload(['REGULAR', 'TODAY']), null);
      expect(capturedIlsPayload?.transactions).toHaveLength(1);
      expect(capturedIlsPayload?.transactions[0].transactionType).toBe('REGULAR');
    });

    it('does not pass FUTURE transactions to the upload client', async () => {
      await runScrape(makeIlsPayload(['REGULAR', 'FUTURE']), null);
      expect(capturedIlsPayload?.transactions).toHaveLength(1);
      expect(capturedIlsPayload?.transactions[0].transactionType).toBe('REGULAR');
    });

    it('counts TODAY and FUTURE as skipped in the task-account-txns-done message', async () => {
      const msgs = await runScrape(makeIlsPayload(['REGULAR', 'TODAY', 'FUTURE']), null);
      const done = msgs.find(
        (m: unknown) =>
          (m as Record<string, unknown>)['type'] === 'task-account-txns-done' &&
          (m as Record<string, unknown>)['txnType'] === 'ils',
      ) as Record<string, unknown> | undefined;
      expect(done).toBeDefined();
      expect(done!['skipped']).toBe(2);
    });

    it('passes all transactions when all are REGULAR', async () => {
      await runScrape(makeIlsPayload(['REGULAR', 'REGULAR']), null);
      expect(capturedIlsPayload?.transactions).toHaveLength(2);
    });

    it('uploads an empty list when all ILS transactions are pending', async () => {
      await runScrape(makeIlsPayload(['TODAY', 'FUTURE']), null);
      expect(capturedIlsPayload?.transactions).toHaveLength(0);
    });
  });

  describe('Foreign transactions', () => {
    it('does not pass TODAY foreign transactions to the upload client', async () => {
      await runScrape(null, makeForeignPayload([{ currency: 'USD', types: ['REGULAR', 'TODAY'] }]));
      const usdEntry = capturedForeignPayload?.balancesAndLimitsDataList[0];
      expect(usdEntry?.transactions).toHaveLength(1);
      expect(usdEntry?.transactions[0].transactionType).toBe('REGULAR');
    });

    it('does not pass FUTURE foreign transactions to the upload client', async () => {
      await runScrape(
        null,
        makeForeignPayload([{ currency: 'USD', types: ['REGULAR', 'FUTURE'] }]),
      );
      const usdEntry = capturedForeignPayload?.balancesAndLimitsDataList[0];
      expect(usdEntry?.transactions).toHaveLength(1);
      expect(usdEntry?.transactions[0].transactionType).toBe('REGULAR');
    });

    it('filters pending transactions across multiple currency entries', async () => {
      await runScrape(
        null,
        makeForeignPayload([
          { currency: 'USD', types: ['REGULAR', 'TODAY'] },
          { currency: 'EUR', types: ['FUTURE', 'REGULAR'] },
        ]),
      );
      const [usd, eur] = capturedForeignPayload!.balancesAndLimitsDataList;
      expect(usd.transactions).toHaveLength(1);
      expect(eur.transactions).toHaveLength(1);
    });

    it('counts foreign pending transactions as skipped in the task-account-txns-done message', async () => {
      const msgs = await runScrape(
        null,
        makeForeignPayload([{ currency: 'USD', types: ['REGULAR', 'TODAY', 'FUTURE'] }]),
      );
      const done = msgs.find(
        (m: unknown) =>
          (m as Record<string, unknown>)['type'] === 'task-account-txns-done' &&
          (m as Record<string, unknown>)['txnType'] === 'foreign',
      ) as Record<string, unknown> | undefined;
      expect(done).toBeDefined();
      expect(done!['skipped']).toBe(2);
    });
  });
});
