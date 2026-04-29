import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import websocketPlugin from '@fastify/websocket';
import type { SourceType } from '../shared/source-types.js';
import { ClientMessageSchema, type ServerMessage } from '../shared/ws-protocol.js';
import { checkAccounts, type ValidatedPayload } from './check-accounts.js';
import { createUploadClient, type UploadClient } from './graphql/client.js';
import { OtpManager } from './otp-manager.js';
import type { AmexPayload } from './payload-schemas/amex.schema.js';
import type { CalPayload } from './payload-schemas/cal.schema.js';
import type { DiscountPayload } from './payload-schemas/discount.schema.js';
import type { IsracardPayload } from './payload-schemas/isracard.schema.js';
import type { MaxPayload } from './payload-schemas/max.schema.js';
import { ERR_RUN_IN_PROGRESS, startRun, type ScrapeTask } from './scrape-runner.js';
import { scrapeAmex } from './scrapers/amex.js';
import { scrapeCal } from './scrapers/cal.js';
import { scrapeDiscount } from './scrapers/discount.js';
import { scrapeIsracard } from './scrapers/isracard.js';
import { scrapeMax } from './scrapers/max.js';
import { scrapePoalim } from './scrapers/poalim.js';
import { getVault, isLocked } from './vault-store.js';
import type { Vault } from './vault.js';

function send(socket: WebSocket, msg: ServerMessage): void {
  socket.send(JSON.stringify(msg));
}

type SourceRef = { id: string; type: SourceType };

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

function buildTask(
  src: SourceRef,
  vault: Vault,
  emit: (msg: ServerMessage) => void,
  otpManager: OtpManager,
  uploadClient: UploadClient | null,
): ScrapeTask {
  return {
    sourceId: src.id,
    nickname: src.id,
    type: src.type,
    run: async () => {
      if (src.type === 'poalim') {
        const creds = vault.poalimAccounts.find(a => a.id === src.id);
        if (!creds) throw new Error(`Poalim account ${src.id} not found in vault`);
        const now = new Date();
        const dateFrom = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
        const headless = vault.settings.showBrowser ? false : true;
        const { ils, foreign, swift } = await scrapePoalim(
          creds,
          dateFrom,
          now,
          headless,
          otpManager,
          emit,
        );
        if (!uploadClient) return { inserted: 0, skipped: 0, insertedIds: [] };

        let totalInserted = 0;
        let totalSkipped = 0;
        const allIds: string[] = [];

        for (const p of ils) {
          const r = await uploadClient.uploadPoalimIls(p);
          totalInserted += r.inserted;
          totalSkipped += r.skipped;
          allIds.push(...r.insertedIds);
        }
        for (const p of foreign) {
          const r = await uploadClient.uploadPoalimForeign(p);
          totalInserted += r.inserted;
          totalSkipped += r.skipped;
          allIds.push(...r.insertedIds);
        }
        for (const p of swift) {
          const r = await uploadClient.uploadPoalimSwift(p);
          totalInserted += r.inserted;
          totalSkipped += r.skipped;
          allIds.push(...r.insertedIds);
        }
        return { inserted: totalInserted, skipped: totalSkipped, insertedIds: allIds };
      }

      const now = new Date();
      const dateFrom = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

      // isracard/amex return one payload per month; other scrapers return a single payload
      let payloads: ValidatedPayload[];
      switch (src.type) {
        case 'isracard': {
          const creds = vault.isracardAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Isracard account ${src.id} not found in vault`);
          payloads = await scrapeIsracard(creds, dateFrom, now, emit);
          break;
        }
        case 'amex': {
          const creds = vault.amexAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Amex account ${src.id} not found in vault`);
          payloads = await scrapeAmex(creds, dateFrom, now, emit);
          break;
        }
        case 'cal': {
          const creds = vault.calAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Cal account ${src.id} not found in vault`);
          payloads = [await scrapeCal(creds, dateFrom, now, emit)];
          break;
        }
        case 'discount': {
          const creds = vault.discountAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Discount account ${src.id} not found in vault`);
          payloads = [await scrapeDiscount(creds, dateFrom, now, emit)];
          break;
        }
        case 'max': {
          const creds = vault.maxAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Max account ${src.id} not found in vault`);
          payloads = [await scrapeMax(creds, dateFrom, now, emit)];
          break;
        }
        default:
          throw new Error(`Unhandled source type: ${src.type}`);
      }

      // Use the first non-empty payload to check for unknown accounts (card identifiers
      // are stable across months for isracard/amex, so any month suffices)
      const representativePayload = payloads[0];
      if (!representativePayload) return { inserted: 0, skipped: 0, insertedIds: [] };

      const check = checkAccounts(src.type, representativePayload, vault.bankAccounts);
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

      if (!uploadClient) return { inserted: 0, skipped: 0, insertedIds: [] };

      // Upload all accepted payloads
      let totalInserted = 0;
      let totalSkipped = 0;
      const allIds: string[] = [];

      if (src.type === 'isracard' || src.type === 'amex') {
        let result;
        switch (src.type) {
          case 'isracard':
            result = await uploadClient.uploadIsracard(payloads as IsracardPayload[]);
            break;
          case 'amex':
            result = await uploadClient.uploadAmex(payloads as AmexPayload[]);
            break;
        }
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        allIds.push(...result.insertedIds);
      } else {
        for (const payload of payloads) {
          let result;
          switch (src.type) {
            case 'cal':
              result = await uploadClient.uploadCal(payload as CalPayload);
              break;
            case 'discount':
              result = await uploadClient.uploadDiscount(payload as DiscountPayload);
              break;
            case 'max':
              result = await uploadClient.uploadMax(payload as MaxPayload);
              break;
            default:
              result = { inserted: 0, skipped: 0, insertedIds: [] };
          }
          totalInserted += result.inserted;
          totalSkipped += result.skipped;
          allIds.push(...result.insertedIds);
        }
      }

      return { inserted: totalInserted, skipped: totalSkipped, insertedIds: allIds };
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
      let activeOtpManager: OtpManager | null = null;

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

            if (activeOtpManager) {
              send(socket, { type: 'run-error', message: ERR_RUN_IN_PROGRESS });
              break;
            }

            activeOtpManager = new OtpManager();
            const uploadClient =
              vault.settings.serverUrl && vault.settings.apiKey
                ? createUploadClient(vault.settings.serverUrl, vault.settings.apiKey)
                : null;
            const tasks: ScrapeTask[] = sources.map(src =>
              buildTask(src, vault, emit, activeOtpManager!, uploadClient),
            );

            void startRun(tasks, vault.settings.concurrentScraping, emit)
              .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                if (message === ERR_RUN_IN_PROGRESS) {
                  send(socket, { type: 'run-error', message });
                } else {
                  app.log.error(err, '[ws] startRun error');
                  send(socket, { type: 'error', message });
                }
              })
              .finally(() => {
                activeOtpManager = null;
              });
            break;
          }
          case 'cancel-scrape':
            // TODO: cancel in-progress scrape
            break;
          case 'otp-submit':
            activeOtpManager?.submitOtp(msg.sourceId, msg.otp);
            app.log.info({ sourceId: msg.sourceId }, '[ws] otp-submit received');
            break;
        }
      });

      socket.on('close', () => {
        app.log.info('[ws] client disconnected');
      });
    },
  );
}
