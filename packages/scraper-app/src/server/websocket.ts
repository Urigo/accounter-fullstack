import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import websocketPlugin from '@fastify/websocket';
import type { SourceType } from '../shared/source-types.js';
import { ClientMessageSchema, type ServerMessage } from '../shared/ws-protocol.js';
import { checkAccounts, type ValidatedPayload } from './check-accounts.js';
import { ERR_RUN_IN_PROGRESS, startRun, type ScrapeTask } from './scrape-runner.js';
import { validatePayload, type PayloadType } from './validate-payload.js';
import { getVault, isLocked } from './vault-store.js';
import type { Vault } from './vault.js';

function send(socket: WebSocket, msg: ServerMessage): void {
  socket.send(JSON.stringify(msg));
}

type SourceRef = { id: string; type: SourceType };

const SOURCE_PAYLOAD_TYPE: Record<SourceType, PayloadType> = {
  poalim: 'poalim-ils',
  discount: 'discount',
  isracard: 'isracard',
  amex: 'amex',
  cal: 'cal',
  max: 'max',
};

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

function makeStubData(type: SourceType): unknown {
  switch (type) {
    case 'poalim':
      return {
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
      };
    case 'discount':
      return {
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
      };
    case 'isracard':
    case 'amex':
      return {
        Header: { Status: '1', Message: null },
        CardsTransactionsListBean: {
          Index0: { '@AllCards': 'AllCards', CurrentCardTransactions: [] },
        },
      };
    case 'cal':
      return { result: { bankAccounts: [] }, statusCode: 1, statusDescription: 'OK' };
    case 'max':
      return { result: { transactions: [] }, returnCode: 0 };
  }
}

function buildTask(src: SourceRef, vault: Vault, emit: (msg: ServerMessage) => void): ScrapeTask {
  return {
    sourceId: src.id,
    nickname: src.id,
    type: src.type,
    run: async () => {
      await new Promise<void>(r => setTimeout(r, 10));
      const raw = makeStubData(src.type);
      const payload = validatePayload(SOURCE_PAYLOAD_TYPE[src.type], raw) as ValidatedPayload;
      const check = checkAccounts(src.type, payload, vault.bankAccounts);
      if (check.unknown.length > 0) {
        emit({
          type: 'task-blocked',
          sourceId: src.id,
          sourceType: src.type,
          unknownAccounts: check.unknown,
        });
        emit({
          type: 'scrape-progress',
          sourceId: src.id,
          sourceType: src.type,
          status: 'blocked',
        });
        return { inserted: 0, skipped: 0, insertedIds: [] };
      }
      return { inserted: 2, skipped: 1, insertedIds: ['a', 'b'] };
    },
  };
}

export async function registerWebSocketRoute(app: FastifyInstance): Promise<void> {
  await app.register(websocketPlugin);

  app.get(
    '/ws',
    {
      websocket: true,
      preValidation: async (_req, reply) => {
        if (isLocked()) {
          await reply.status(401).send({ error: 'vault-locked' });
        }
      },
    },
    (socket: WebSocket, _req) => {
      socket.on('error', err => app.log.error({ err }, '[ws] socket error'));
      send(socket, { type: 'connected' });

      const emit = (msg: ServerMessage) => send(socket, msg);

      socket.on('message', (raw: RawData) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          app.log.warn('[ws] non-JSON message received');
          return;
        }

        const result = ClientMessageSchema.safeParse(parsed);
        if (!result.success) {
          app.log.warn({ received: parsed }, '[ws] unknown message type');
          send(socket, { type: 'error', message: 'Unknown message type' });
          return;
        }

        const msg = result.data;
        switch (msg.type) {
          case 'ping':
            send(socket, { type: 'pong' });
            break;
          case 'run-start':
          case 'start-scrape': {
            let vault: Vault;
            try {
              vault = getVault();
            } catch (e) {
              send(socket, { type: 'error', message: String(e) });
              break;
            }

            const allRefs = collectSourceRefs(vault);
            const sourceIds = msg.sourceIds;
            const sources = sourceIds ? allRefs.filter(s => sourceIds.includes(s.id)) : allRefs;

            if (sources.length === 0) {
              send(socket, { type: 'run-error', message: 'No matching sources found' });
              break;
            }

            const tasks: ScrapeTask[] = sources.map(src => buildTask(src, vault, emit));

            void startRun(tasks, vault.settings.concurrentScraping, emit).catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err);
              if (message === ERR_RUN_IN_PROGRESS) {
                send(socket, { type: 'run-error', message });
              } else {
                app.log.error(err, '[ws] startRun error');
                send(socket, { type: 'error', message });
              }
            });
            break;
          }
          case 'cancel-scrape':
            // TODO: cancel in-progress scrape
            break;
          case 'otp-submit':
            app.log.info({ sourceId: msg.sourceId }, '[ws] otp-submit received (stub)');
            break;
        }
      });

      socket.on('close', () => {
        app.log.info('[ws] client disconnected');
      });
    },
  );
}
