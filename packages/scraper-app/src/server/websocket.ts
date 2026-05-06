import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import websocketPlugin from '@fastify/websocket';
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
import { BlockedError, ERR_RUN_IN_PROGRESS, startRun, type ScrapeTask } from './scrape-runner.js';
import { scrapeAmex, type MonthlyIsracardPayload as MonthlyAmexPayload } from './scrapers/amex.js';
import { scrapeCal } from './scrapers/cal.js';
import { scrapeCurrencyRates } from './scrapers/currency-rates.js';
import { scrapeDiscount } from './scrapers/discount.js';
import {
  countIsracardTransactions,
  scrapeIsracard,
  type MonthlyIsracardPayload,
} from './scrapers/isracard.js';
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
      const headless = !vault.settings.showBrowser;
      if (src.type === 'poalim') {
        const creds = vault.poalimAccounts.find(a => a.id === src.id);
        if (!creds) throw new Error(`Poalim account ${src.id} not found in vault`);
        const { ils, foreign, swift } = await scrapePoalim(
          creds,
          dateFrom,
          dateTo,
          headless,
          otpManager,
          emit,
        );

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
        const insertedTransactions: InsertedTransactionSummary[] = [];
        const changedTransactions: ChangedTransaction[] = [];
        const bankAccount = {
          bankNumber: 0,
          branchNumber: 0,
          accountNumber: 0,
        };

        for (let i = 0; i < ils.length; i++) {
          const ilsPayload = ils[i]!;
          const accountId = ilsPayload.retrievalTransactionData
            ? `${ilsPayload.retrievalTransactionData.branchNumber}-${ilsPayload.retrievalTransactionData.accountNumber}`
            : `unknown:${i}`;
          if (ilsPayload.retrievalTransactionData) {
            bankAccount.accountNumber = ilsPayload.retrievalTransactionData.accountNumber;
            bankAccount.branchNumber = ilsPayload.retrievalTransactionData.branchNumber;
            bankAccount.bankNumber = ilsPayload.retrievalTransactionData.bankNumber;
          }

          // Emit vault-checked status based on whether account was excluded
          emit({
            type: 'task-account-vault-checked',
            sourceId: src.id,
            accountId,
            status: 'accepted',
          });

          const ilsCount = ilsPayload.transactions?.length ?? 0;
          emit({
            type: 'task-account-txns-uploading',
            sourceId: src.id,
            accountId,
            txnType: 'ils',
            count: ilsCount,
          });
          const r = await uploadClient.uploadPoalimIls(ilsPayload);
          emit({
            type: 'task-account-txns-done',
            sourceId: src.id,
            accountId,
            txnType: 'ils',
            inserted: r.inserted,
            skipped: r.skipped,
          });
          totalInserted += r.inserted;
          totalSkipped += r.skipped;
          allIds.push(...r.insertedIds);
          insertedTransactions.push(...(r.insertedTransactions ?? []));
          changedTransactions.push(...(r.changedTransactions ?? []));

          if (foreign[i]) {
            const foreignPayload = foreign[i]!;
            const foreignCount =
              (foreignPayload as { transactions?: unknown[] }).transactions?.length ?? 0;
            emit({
              type: 'task-account-txns-uploading',
              sourceId: src.id,
              accountId,
              txnType: 'foreign',
              count: foreignCount,
            });
            const rf = await uploadClient.uploadPoalimForeign(foreignPayload, bankAccount);
            emit({
              type: 'task-account-txns-done',
              sourceId: src.id,
              accountId,
              txnType: 'foreign',
              inserted: rf.inserted,
              skipped: rf.skipped,
            });
            totalInserted += rf.inserted;
            totalSkipped += rf.skipped;
            allIds.push(...rf.insertedIds);
            insertedTransactions.push(...(rf.insertedTransactions ?? []));
            changedTransactions.push(...(rf.changedTransactions ?? []));
          }

          if (swift[i]) {
            const swiftPayload = swift[i]!;
            const swiftCount = (swiftPayload as { swiftsList?: unknown[] }).swiftsList?.length ?? 0;
            emit({
              type: 'task-account-txns-uploading',
              sourceId: src.id,
              accountId,
              txnType: 'swift',
              count: swiftCount,
            });
            const rs = await uploadClient.uploadPoalimSwift(swiftPayload, bankAccount);
            emit({
              type: 'task-account-txns-done',
              sourceId: src.id,
              accountId,
              txnType: 'swift',
              inserted: rs.inserted,
              skipped: rs.skipped,
            });
            totalInserted += rs.inserted;
            totalSkipped += rs.skipped;
            allIds.push(...rs.insertedIds);
            insertedTransactions.push(...(rs.insertedTransactions ?? []));
            changedTransactions.push(...(rs.changedTransactions ?? []));
          }
        }
        return {
          inserted: totalInserted,
          skipped: totalSkipped,
          insertedIds: allIds,
          insertedTransactions,
          changedTransactions,
        };
      }

      // isracard/amex return one payload per month; other scrapers return a single payload
      let isracardPayloads: (MonthlyIsracardPayload | MonthlyAmexPayload)[] | null = null;
      let payloads: ValidatedPayload[];

      switch (src.type) {
        case 'isracard': {
          const creds = vault.isracardAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Isracard account ${src.id} not found in vault`);
          isracardPayloads = await scrapeIsracard(creds, dateFrom, dateTo, emit, headless);
          payloads = isracardPayloads.map(p => p.data);
          break;
        }
        case 'amex': {
          const creds = vault.amexAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Amex account ${src.id} not found in vault`);
          isracardPayloads = await scrapeAmex(creds, dateFrom, dateTo, emit, headless);
          payloads = isracardPayloads.map(p => p.data);
          break;
        }
        case 'cal': {
          const creds = vault.calAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Cal account ${src.id} not found in vault`);
          payloads = [await scrapeCal(creds, dateFrom, dateTo, emit, headless)];
          break;
        }
        case 'discount': {
          const creds = vault.discountAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Discount account ${src.id} not found in vault`);
          payloads = [await scrapeDiscount(creds, dateFrom, dateTo, emit, headless)];
          break;
        }
        case 'max': {
          const creds = vault.maxAccounts.find(a => a.id === src.id);
          if (!creds) throw new Error(`Max account ${src.id} not found in vault`);
          payloads = [await scrapeMax(creds, dateFrom, dateTo, emit, headless)];
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
        isracardPayloads &&= isracardPayloads.map((p, i) => ({
          ...p,
          data: payloads[i] as (typeof p)['data'],
        }));
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
        throw new BlockedError(check.unknown);
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

      if ((src.type === 'isracard' || src.type === 'amex') && isracardPayloads) {
        for (const { month, data: monthData } of isracardPayloads) {
          const txnCount = countIsracardTransactions(monthData);
          emit({
            type: 'task-month-uploading',
            sourceId: src.id,
            month,
            transactionCount: txnCount,
          });
          let result: ScraperUploadResult;
          if (src.type === 'isracard') {
            result = await uploadClient.uploadIsracard([monthData]);
          } else {
            result = await uploadClient.uploadAmex([monthData]);
          }
          emit({
            type: 'task-month-uploaded',
            sourceId: src.id,
            month,
            inserted: result.inserted,
            skipped: result.skipped,
          });
          totalInserted += result.inserted;
          totalSkipped += result.skipped;
          allIds.push(...result.insertedIds);
          changedTransactions.push(...(result.changedTransactions ?? []));
          insertedTransactions.push(...(result.insertedTransactions ?? []));
        }
      } else {
        for (const payload of payloads) {
          let result: ScraperUploadResult;
          switch (src.type) {
            case 'cal': {
              for (const entry of payload as CalPayload) {
                emit({
                  type: 'task-month-uploading',
                  sourceId: src.id,
                  month: entry.month,
                  transactionCount: entry.transactions.length,
                });
                result = await uploadClient.uploadCal([entry]);
                emit({
                  type: 'task-month-uploaded',
                  sourceId: src.id,
                  month: entry.month,
                  inserted: result.inserted,
                  skipped: result.skipped,
                });
                totalInserted += result.inserted;
                totalSkipped += result.skipped;
                allIds.push(...result.insertedIds);
                changedTransactions.push(...(result.changedTransactions ?? []));
                insertedTransactions.push(...(result.insertedTransactions ?? []));
              }
              result = {
                inserted: 0,
                skipped: 0,
                insertedIds: [],
                changedTransactions: [],
                insertedTransactions: [],
              };
              break;
            }
            case 'discount': {
              for (const entry of payload as DiscountPayload) {
                emit({
                  type: 'task-month-uploading',
                  sourceId: src.id,
                  month: entry.month,
                  transactionCount: entry.transactions.length,
                });
                result = await uploadClient.uploadDiscount([entry]);
                emit({
                  type: 'task-month-uploaded',
                  sourceId: src.id,
                  month: entry.month,
                  inserted: result.inserted,
                  skipped: result.skipped,
                });
                totalInserted += result.inserted;
                totalSkipped += result.skipped;
                allIds.push(...result.insertedIds);
                changedTransactions.push(...(result.changedTransactions ?? []));
                insertedTransactions.push(...(result.insertedTransactions ?? []));
              }
              result = {
                inserted: 0,
                skipped: 0,
                insertedIds: [],
                changedTransactions: [],
                insertedTransactions: [],
              };
              break;
            }
            case 'max': {
              for (const account of payload as MaxPayload) {
                emit({
                  type: 'task-month-uploading',
                  sourceId: src.id,
                  month: account.accountNumber,
                  transactionCount: account.txns.length,
                });
                result = await uploadClient.uploadMax([account]);
                emit({
                  type: 'task-month-uploaded',
                  sourceId: src.id,
                  month: account.accountNumber,
                  inserted: result.inserted,
                  skipped: result.skipped,
                });
                totalInserted += result.inserted;
                totalSkipped += result.skipped;
                allIds.push(...result.insertedIds);
                changedTransactions.push(...(result.changedTransactions ?? []));
                insertedTransactions.push(...(result.insertedTransactions ?? []));
              }
              result = {
                inserted: 0,
                skipped: 0,
                insertedIds: [],
                changedTransactions: [],
                insertedTransactions: [],
              };
              break;
            }
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
                  const payload = await scrapeCurrencyRates(emit, runDateFrom, runDateTo);
                  if (!uploadClient)
                    return {
                      inserted: 0,
                      skipped: 0,
                      insertedIds: [],
                      changedTransactions: [],
                      insertedTransactions: [],
                    };
                  emit({
                    type: 'task-month-uploading',
                    sourceId: 'currency-rates',
                    month: 'rates',
                    transactionCount: payload.length,
                  });
                  const result = await uploadClient.uploadCurrencyRates(payload);
                  emit({
                    type: 'task-month-uploaded',
                    sourceId: 'currency-rates',
                    month: 'rates',
                    inserted: result.inserted,
                    skipped: result.skipped,
                  });
                  return result;
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
                        completedAt: runRecord.completedAt.toISOString(),
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
