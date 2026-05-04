import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import websocketPlugin from '@fastify/websocket';
import type { IsracardCardsTransactionsList } from '@accounter/modern-poalim-scraper';
import type { SourceType } from '../shared/source-types.js';
import { ClientMessageSchema, type ServerMessage } from '../shared/ws-protocol.js';
import { registerDiscoveredAccounts } from './account-discovery.js';
import { checkAccounts, type ValidatedPayload } from './check-accounts.js';
import { filterPayload, type FilterableCreds } from './filter-payload.js';
import { ChangedTransaction, InsertedTransactionSummary } from './gql/index.js';
import { createUploadClient, ScraperUploadResult, type UploadClient } from './graphql/client.js';
import { appendRun } from './history.js';
import { OtpManager } from './otp-manager.js';
import type { CalPayload } from './payload-schemas/cal.schema.js';
import type { DiscountPayload } from './payload-schemas/discount.schema.js';
import type { MaxPayload } from './payload-schemas/max.schema.js';
import type { PoalimIlsPayload } from './payload-schemas/poalim-ils.schema.js';
import { BlockedError, ERR_RUN_IN_PROGRESS, startRun, type ScrapeTask } from './scrape-runner.js';
import { scrapeAmex } from './scrapers/amex.js';
import { scrapeCal } from './scrapers/cal.js';
import { scrapeCurrencyRates } from './scrapers/currency-rates.js';
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
  dateFrom: Date,
  dateTo: Date,
): ScrapeTask {
  return {
    sourceId: src.id,
    nickname: src.id,
    type: src.type,
    run: async () => {
      if (src.type === 'poalim') {
        const creds = vault.poalimAccounts.find(a => a.id === src.id);
        if (!creds) throw new Error(`Poalim account ${src.id} not found in vault`);
        const headless = !vault.settings.showBrowser;
        const { ils, foreign, swift } = await scrapePoalim(
          creds,
          dateFrom,
          dateTo,
          headless,
          otpManager,
          emit,
        );

        // ILS, Foreign, and Swift arrays are positionally aligned per account (same index = same account).
        // ILS payloads carry account/branch identifiers; Foreign and Swift do not.
        // Filter ILS first — filterPayload zeros its transactions array when the account is excluded.
        // Use that result to gate Foreign/Swift at the same index.
        const filteredIls = ils.map(p => filterPayload('poalim', p, creds) as PoalimIlsPayload);

        // Register any newly discovered accounts as pending, then re-read to avoid stale closure
        await registerDiscoveredAccounts('poalim', src.id, filteredIls);
        const currentAccountRecords = getVault().accountRecords;

        // Check for unknown accounts across all ILS payloads (ILS carries account identifiers)
        const allUnknown: string[] = [];
        for (const p of filteredIls) {
          const check = checkAccounts('poalim', p, currentAccountRecords);
          allUnknown.push(...check.unknown);
        }
        if (allUnknown.length > 0) {
          emit({
            type: 'task-blocked',
            sourceId: src.id,
            sourceType: src.type,
            unknownAccounts: [...new Set(allUnknown)],
          });
          throw new BlockedError();
        }

        if (!uploadClient)
          return {
            inserted: 0,
            skipped: 0,
            insertedIds: [],
            insertedTransactions: [],
            changedTransactions: [],
          };

        let totalInserted = 0;
        let totalSkipped = 0;
        const allIds: string[] = [];

        for (let i = 0; i < filteredIls.length; i++) {
          const ilsPayload = filteredIls[i]!;
          // An empty transactions array means filterPayload excluded this account — skip all sub-types.
          const accountExcluded = ilsPayload.transactions?.length === 0;

          const r = await uploadClient.uploadPoalimIls(ilsPayload);
          totalInserted += r.inserted;
          totalSkipped += r.skipped;
          allIds.push(...r.insertedIds);

          if (!accountExcluded) {
            if (foreign[i]) {
              const rf = await uploadClient.uploadPoalimForeign(foreign[i]!);
              totalInserted += rf.inserted;
              totalSkipped += rf.skipped;
              allIds.push(...rf.insertedIds);
            }
            if (swift[i]) {
              const rs = await uploadClient.uploadPoalimSwift(swift[i]!);
              totalInserted += rs.inserted;
              totalSkipped += rs.skipped;
              allIds.push(...rs.insertedIds);
            }
          }
        }
        return {
          inserted: totalInserted,
          skipped: totalSkipped,
          insertedIds: allIds,
          insertedTransactions: [],
          changedTransactions: [],
        };
      }

      // isracard/amex return one payload per month; other scrapers return a single payload
      let payloads: ValidatedPayload[];
      switch (src.type) {
        case 'isracard': {
          const creds = vault.isracardAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Isracard account ${src.id} not found in vault`);
          payloads = await scrapeIsracard(creds, dateFrom, dateTo, emit);
          break;
        }
        case 'amex': {
          const creds = vault.amexAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Amex account ${src.id} not found in vault`);
          payloads = await scrapeAmex(creds, dateFrom, dateTo, emit);
          break;
        }
        case 'cal': {
          const creds = vault.calAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Cal account ${src.id} not found in vault`);
          payloads = [await scrapeCal(creds, dateFrom, dateTo, emit)];
          break;
        }
        case 'discount': {
          const creds = vault.discountAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Discount account ${src.id} not found in vault`);
          payloads = [await scrapeDiscount(creds, dateFrom, dateTo, emit)];
          break;
        }
        case 'max': {
          const creds = vault.maxAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Max account ${src.id} not found in vault`);
          payloads = [await scrapeMax(creds, dateFrom, dateTo, emit)];
          break;
        }
        default:
          throw new Error(`Unhandled source type: ${src.type}`);
      }

      // Use the first non-empty payload to check for unknown accounts (card identifiers
      // are stable across months for isracard/amex, so any month suffices)
      const representativePayload = payloads[0];
      if (!representativePayload)
        return {
          inserted: 0,
          skipped: 0,
          insertedIds: [],
          insertedTransactions: [],
          changedTransactions: [],
        };

      // Apply per-source accepted/ignored filter after validation, before account check
      let creds: FilterableCreds | undefined;
      switch (src.type) {
        case 'isracard':
          creds = vault.isracardAccounts.find(a => a.id === src.id);
          break;
        case 'amex':
          creds = vault.amexAccounts.find(a => a.id === src.id);
          break;
        case 'cal':
          creds = vault.calAccounts.find(a => a.id === src.id);
          break;
        case 'max':
          creds = vault.maxAccounts.find(a => a.id === src.id);
          break;
        case 'discount':
          creds = vault.discountAccounts.find(a => a.id === src.id);
          break;
      }

      if (creds) {
        payloads = payloads.map(p => filterPayload(src.type, p, creds!) as ValidatedPayload);
      }

      // Register any newly discovered accounts as pending, then re-read to avoid stale closure
      await registerDiscoveredAccounts(src.type, src.id, payloads);
      const check = checkAccounts(src.type, payloads[0]!, getVault().accountRecords);
      if (check.unknown.length > 0) {
        emit({
          type: 'task-blocked',
          sourceId: src.id,
          sourceType: src.type,
          unknownAccounts: check.unknown,
        });
        throw new BlockedError();
      }

      if (!uploadClient)
        return {
          inserted: 0,
          skipped: 0,
          insertedIds: [],
          insertedTransactions: [],
          changedTransactions: [],
        };

      // Upload all accepted payloads
      let totalInserted = 0;
      let totalSkipped = 0;
      const allIds: string[] = [];
      const changedTransactions: ChangedTransaction[] = [];
      const insertedTransactions: InsertedTransactionSummary[] = [];

      if (src.type === 'isracard' || src.type === 'amex') {
        let result: ScraperUploadResult;
        switch (src.type) {
          case 'isracard':
            result = await uploadClient.uploadIsracard(payloads as IsracardCardsTransactionsList[]);
            break;
          case 'amex':
            result = await uploadClient.uploadAmex(payloads as IsracardCardsTransactionsList[]);
            break;
        }
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        allIds.push(...result.insertedIds);
        changedTransactions.push(...(result.changedTransactions ?? []));
        insertedTransactions.push(...(result.insertedTransactions ?? []));
      } else {
        for (const payload of payloads) {
          let result: ScraperUploadResult;
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
              result = {
                inserted: 0,
                skipped: 0,
                insertedIds: [],
                changedTransactions: [],
                insertedTransactions: [],
              };
          }
          totalInserted += result.inserted;
          totalSkipped += result.skipped;
          allIds.push(...result.insertedIds);
        }
      }

      return {
        inserted: totalInserted,
        skipped: totalSkipped,
        insertedIds: allIds,
        changedTransactions,
        insertedTransactions,
      };
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
          case 'run-start': {
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

            if (sources.length === 0 && !vault.settings.fetchBankOfIsraelRates) {
              send(socket, { type: 'run-error', message: 'No matching sources found' });
              break;
            }

            if (activeOtpManager) {
              send(socket, { type: 'run-error', message: ERR_RUN_IN_PROGRESS });
              break;
            }

            // Resolve date range: message overrides settings default
            const runDateTo = msg.dateTo ? new Date(msg.dateTo) : new Date();
            const months = vault.settings.defaultDateRangeMonths ?? 3;
            const runDateFrom = msg.dateFrom
              ? new Date(msg.dateFrom)
              : new Date(
                  runDateTo.getFullYear(),
                  runDateTo.getMonth() - months,
                  runDateTo.getDate(),
                );

            activeOtpManager = new OtpManager();
            const uploadClient =
              vault.settings.serverUrl && vault.settings.apiKey
                ? createUploadClient(vault.settings.serverUrl, vault.settings.apiKey)
                : null;
            const tasks: ScrapeTask[] = sources.map(src =>
              buildTask(src, vault, emit, activeOtpManager!, uploadClient, runDateFrom, runDateTo),
            );

            // Append currency-rates task if enabled
            if (vault.settings.fetchBankOfIsraelRates) {
              tasks.push({
                sourceId: 'currency-rates',
                nickname: 'Currency Rates (Bank of Israel)',
                type: 'currency-rates',
                run: async () => {
                  const payload = await scrapeCurrencyRates(emit);
                  if (!uploadClient)
                    return {
                      inserted: 0,
                      skipped: 0,
                      insertedIds: [],
                      changedTransactions: [],
                      insertedTransactions: [],
                    };
                  return uploadClient.uploadCurrencyRates(payload);
                },
              });
            }

            const { saveHistory, historyFilePath } = vault.settings;
            void startRun(tasks, vault.settings.concurrentScraping, emit)
              .then(async runRecord => {
                if (saveHistory) {
                  try {
                    await appendRun(
                      {
                        ...runRecord,
                        startedAt: runRecord.startedAt.toISOString(),
                        finishedAt: runRecord.finishedAt.toISOString(),
                      },
                      historyFilePath,
                    );
                  } catch (err) {
                    app.log.error(err, '[ws] failed to append run history');
                  }
                }
              })
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
