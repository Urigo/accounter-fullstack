import { GraphQLError, type GraphQLResolveInfo } from 'graphql';
import { type Injector } from 'graphql-modules';
import { Repeater } from 'graphql-yoga';
import {
  ChargeSortByField,
  type Resolvers,
  type ResolversTypes,
} from '../../../__generated__/types.js';
import { EMPTY_UUID } from '../../../shared/constants.js';
import type { Currency } from '../../../shared/enums.js';
import { formatFinancialAmount } from '../../../shared/helpers/index.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
import {
  getChargeDocumentsMeta,
  getChargeTransactionsMeta,
} from '../../charges/helpers/common.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { accountant_statusArray, type IGetChargesByIdsResult } from '../../charges/types.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '../../financial-entities/types.js';
import {
  ledgerGenerationByCharge,
  ledgerUnbalancedBusinessesByCharge,
} from '../helpers/ledger-by-charge-type.helper.js';
import { isChargeLocked } from '../helpers/ledger-lock.js';
import {
  convertLedgerRecordToInput,
  convertLedgerRecordToProto,
  ledgerRecordsGenerationFullMatchComparison,
  ledgerRecordsGenerationPartialMatchComparison,
} from '../helpers/ledgrer-storage.helper.js';
import { getLedgerBalanceInfo, updateLedgerBalanceByEntry } from '../helpers/utils.helper.js';
import { LedgerProvider } from '../providers/ledger.provider.js';
import type {
  IGetLedgerRecordsByChargesIdsResult,
  IInsertLedgerRecordsParams,
  LedgerModule,
} from '../types.js';
import { commonChargeLedgerResolver } from './common.resolver.js';

// Resolve a ledger record's local currency from its OWNING business, so
// multi-business reads format each record in the right currency. Falls back to
// the request's primary business when the per-business preference is missing.
async function recordLocalCurrency(
  injector: Injector,
  ownerId: string | null | undefined,
): Promise<Currency> {
  if (ownerId) {
    const currency = await injector
      .get(ScopeProvider)
      .getBusinessPreference(ownerId, 'defaultLocalCurrency');
    if (currency) {
      return currency;
    }
  }
  const { defaultLocalCurrency } = await injector
    .get(AdminContextProvider)
    .getVerifiedAdminContext();
  return defaultLocalCurrency;
}

// When the main financial document (usually the invoice) and the main
// transaction settle in different currencies, the charge requires the dedicated
// invoice/payment currency-diff handling. If that flag is off, surface an error
// so the user knows to turn the "Invoice-Payment currency difference" switch on.
async function getInvoicePaymentCurrencyDiffErrors(
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<string[]> {
  if (charge.invoice_payment_currency_diff) {
    return [];
  }

  try {
    const [{ documentsCurrency }, { transactionsCurrency }] = await Promise.all([
      getChargeDocumentsMeta(charge, injector),
      getChargeTransactionsMeta(charge, injector),
    ]);

    if (documentsCurrency && transactionsCurrency && documentsCurrency !== transactionsCurrency) {
      return [
        `Main document currency (${documentsCurrency}) differs from main transaction currency (${transactionsCurrency}). Turn on the "Invoice-Payment currency difference" switch for this charge.`,
      ];
    }

    return [];
  } catch (err) {
    // This check is display-only; a loader/DB failure here must not turn the
    // whole validation into an error. Log and fall back to no extra errors.
    console.error(
      `Failed to evaluate invoice/payment currency-diff for charge ID="${charge.id}"`,
      err,
    );
    return [];
  }
}

// Reject an inverted date range before it reaches the DB — an inverted range
// silently returns zero rows, which reads as "no ledger records" rather than as
// the caller error it is.
function assertLedgerDateRange(
  label: string,
  from: string | null | undefined,
  to: string | null | undefined,
): void {
  if (from && to && from > to) {
    throw new GraphQLError(`${label} "from" date must be before or equal to the "to" date`);
  }
}

// Max charges regenerated in parallel by `regenerateLedgerRecords`. Keeps large
// batch selections from saturating the DB connection pool.
const REGENERATE_LEDGER_CONCURRENCY = 5;

// Regenerate the ledger records for a single charge. Any failure (charge not
// found, locked, or a generation/storage error) is returned as a `CommonError`
// rather than thrown, so a batched call never aborts the remaining charges.
async function regenerateSingleChargeLedgerRecords(
  chargeId: string,
  context: GraphQLModules.ModuleContext,
  info: GraphQLResolveInfo,
): Promise<ResolversTypes['GeneratedLedgerRecords']> {
  const { injector } = context;
  try {
    const { ledgerLock, ownerId } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
    if (!charge) {
      return {
        __typename: 'CommonError',
        message: `Charge with id ${chargeId} not found`,
      };
    }
    if (await isChargeLocked(charge, injector, ledgerLock)) {
      return {
        __typename: 'CommonError',
        message: `Charge with id ${chargeId} is locked`,
      };
    }

    const generated = await ledgerGenerationByCharge(
      charge,
      { insertLedgerRecordsIfNotExists: true },
      context,
      info,
    );
    if (!generated || 'message' in generated) {
      const message = generated?.message ?? 'generation error';
      throw new Error(message);
    }

    const records = generated.records as IGetLedgerRecordsByChargesIdsResult[];

    const storageLedgerRecords = await injector
      .get(LedgerProvider)
      .getLedgerRecordsByChargesIdLoader.load(chargeId);

    const fullMatching = ledgerRecordsGenerationFullMatchComparison(storageLedgerRecords, records);

    if (fullMatching.isFullyMatched) {
      return {
        records: storageLedgerRecords,
        charge,
        errors: generated.errors,
      };
    }

    const { toUpdate, toRemove } = ledgerRecordsGenerationPartialMatchComparison(
      fullMatching.unmatchedStorageRecords,
      fullMatching.unmatchedNewRecords,
    );

    const [newRecords, recordsToUpdate] = toUpdate.reduce(
      (acc, record) => {
        if (record.id === EMPTY_UUID) {
          acc[0].push(record);
        } else {
          acc[1].push(record);
        }
        return acc;
      },
      [[], []] as [IGetLedgerRecordsByChargesIdsResult[], IGetLedgerRecordsByChargesIdsResult[]],
    );

    const updatePromise = injector
      .get(LedgerProvider)
      .deleteLedgerRecordsByIdLoader.loadMany(recordsToUpdate.map(r => r.id))
      .catch(e => {
        const message = `Failed to delete ledger records for charge ID="${chargeId}"`;
        console.error(`${message}: ${e}`);
        if (e instanceof GraphQLError) {
          throw e;
        }
        throw new Error(message);
      })
      .then(() =>
        injector.get(LedgerProvider).insertLedgerRecords({
          ledgerRecords: recordsToUpdate
            .map(record => convertLedgerRecordToInput(record, ownerId))
            .map(record => {
              record.chargeId = chargeId;
              return record as IInsertLedgerRecordsParams['ledgerRecords'][number];
            }),
        }),
      )
      .catch(e => {
        if (e instanceof GraphQLError) {
          throw e;
        }
        const message = `Failed to update ledger records for charge ID="${chargeId}"`;
        console.error(`${message}: ${e}`);
        throw new Error(message);
      });
    const insertPromise =
      newRecords.length > 0
        ? injector
            .get(LedgerProvider)
            .insertLedgerRecords({
              ledgerRecords: newRecords.map(record =>
                convertLedgerRecordToInput(record, ownerId),
              ) as IInsertLedgerRecordsParams['ledgerRecords'],
            })
            .catch(e => {
              const message = `Failed to insert new ledger records for charge ID="${chargeId}"`;
              console.error(`${message}: ${e}`);
              if (e instanceof GraphQLError) {
                throw e;
              }
              throw new Error(message);
            })
        : Promise.resolve();
    const removePromises = toRemove.map(record =>
      injector
        .get(LedgerProvider)
        .deleteLedgerRecordsByIdLoader.load(record.id)
        .catch(e => {
          const message = `Failed to delete ledger records for charge ID="${chargeId}"`;
          console.error(`${message}: ${e}`);
          if (e instanceof GraphQLError) {
            throw e;
          }
          throw new Error(message);
        }),
    );
    await Promise.all([updatePromise, insertPromise, ...removePromises]);

    const degradedCharges = await degradeChargesAccountantApproval(injector, [chargeId]);

    return {
      records: toUpdate,
      charge: degradedCharges.get(chargeId) ?? charge,
      errors: generated.errors,
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
}

export const ledgerResolvers: LedgerModule.Resolvers & Pick<Resolvers, 'GeneratedLedgerRecords'> = {
  Query: {
    chargesWithLedgerChanges: async (_, { filters, limit }, context, info) => {
      const { injector } = context;
      const { ledgerLock } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

      // handle sort column
      let sortColumn: 'event_date' | 'event_amount' | 'abs_event_amount' = 'event_date';
      switch (filters?.sortBy?.field) {
        case ChargeSortByField.Amount:
          sortColumn = 'event_amount';
          break;
        case ChargeSortByField.AbsAmount:
          sortColumn = 'abs_event_amount';
          break;
        case ChargeSortByField.Date:
          sortColumn = 'event_date';
          break;
      }

      // get max date of filter and ledger lock
      const fromDate =
        ledgerLock || filters?.fromDate
          ? [ledgerLock, filters?.fromDate].filter(Boolean).sort().reverse()[0]
          : undefined;

      const charges = await injector
        .get(ChargesProvider)
        .getChargesByFilters({
          ownerIds: filters?.byOwners,
          fromDate,
          toDate: filters?.toDate,
          fromAnyDate: filters?.fromAnyDate,
          toAnyDate: filters?.toAnyDate,
          sortColumn,
          asc: filters?.sortBy?.asc !== false,
          chargeType: filters?.chargesType,
          businessIds: filters?.byBusinesses,
          withoutInvoice: filters?.withoutInvoice,
          withoutReceipt: filters?.withoutReceipt,
          withoutDocuments: filters?.withoutDocuments,
          withoutLedger: filters?.withoutLedger,
          tags: filters?.byTags,
          accountantStatuses: filters?.accountantStatus as accountant_statusArray | undefined,
        })
        .catch(e => {
          const message = 'Error fetching charges';
          console.error(`${message}: ${e}`);
          throw new Error(message);
        });

      const limitedCharges = limit ? charges.slice(0, limit) : charges;

      return new Repeater<ResolversTypes['ChargesWithLedgerChangesResult']>(async (push, stop) => {
        push({ progress: 20 });
        let handledCharges: number = 0;

        function calculateProgress() {
          return ((handledCharges * 100) / limitedCharges.length) * 0.8 + 20;
        }

        await Promise.all(
          limitedCharges.map(async charge => {
            if (await isChargeLocked(charge, injector, ledgerLock)) {
              handledCharges++;
              if (handledCharges % 50 === 0 || handledCharges === limitedCharges.length) {
                push({ progress: calculateProgress() });
              }
              return;
            }
            try {
              const generatedRecordsPromise = ledgerGenerationByCharge(
                charge,
                { insertLedgerRecordsIfNotExists: false },
                context,
                info,
              );
              const storageRecordsPromise = injector
                .get(LedgerProvider)
                .getLedgerRecordsByChargesIdLoader.load(charge.id);

              const [generatedRecords, storageRecords] = await Promise.all([
                generatedRecordsPromise,
                storageRecordsPromise,
              ]);

              if (!generatedRecords || 'message' in generatedRecords) {
                handledCharges++;
                push({ progress: calculateProgress(), charge });
                return;
              }

              const newRecords = generatedRecords.records as IGetLedgerRecordsByChargesIdsResult[];

              const fullMatching = ledgerRecordsGenerationFullMatchComparison(
                storageRecords,
                newRecords,
              );

              if (fullMatching.isFullyMatched) {
                handledCharges++;
                if (handledCharges % 50 === 0 || handledCharges === limitedCharges.length) {
                  push({ progress: calculateProgress() });
                }
                return;
              }

              handledCharges++;
              push({ progress: calculateProgress(), charge });
            } catch (err) {
              console.error(err);
              handledCharges++;
              push({ progress: calculateProgress(), charge });
            }
          }),
        );
        push({ progress: 100 });
        stop();
      }) as unknown as Promise<readonly ResolversTypes['ChargesWithLedgerChangesResult'][]>;
    },
    ledgerRecordsByDates: async (_, { fromDate, toDate }, { injector }) => {
      if (fromDate > toDate) {
        throw new GraphQLError('fromDate must be before or equal to toDate');
      }
      const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      return await injector
        .get(LedgerProvider)
        .getLedgerRecordsByDates({
          fromDate,
          toDate,
          ownerId,
        })
        .then(records =>
          records.sort((a, b) => a.invoice_date.getTime() - b.invoice_date.getTime()),
        )
        .catch(error => {
          console.error('Failed to fetch ledger records:', error);
          throw new GraphQLError('Failed to fetch ledger records');
        });
    },
    ledgerRecordsByFinancialEntity: async (_, { financialEntityId }, { injector }) => {
      return await injector
        .get(LedgerProvider)
        .getLedgerRecordsByFinancialEntityIdLoader.load(financialEntityId);
    },
    ledgerRecordsByFilters: async (_, { filters }, { injector }) => {
      assertLedgerDateRange('invoice', filters?.fromInvoiceDate, filters?.toInvoiceDate);
      assertLedgerDateRange('value', filters?.fromValueDate, filters?.toValueDate);
      assertLedgerDateRange('any', filters?.fromAnyDate, filters?.toAnyDate);

      return await injector
        .get(LedgerProvider)
        .getLedgerRecordsByFilters({
          fromInvoiceDate: filters?.fromInvoiceDate,
          toInvoiceDate: filters?.toInvoiceDate,
          fromValueDate: filters?.fromValueDate,
          toValueDate: filters?.toValueDate,
          fromAnyDate: filters?.fromAnyDate,
          toAnyDate: filters?.toAnyDate,
          financialEntityIds: filters?.financialEntityIds,
          financialEntityAccounts: filters?.financialEntityAccounts,
          ownerIds: filters?.ownerIds,
          chargeIds: filters?.chargeIds,
          limit: filters?.limit,
        })
        .catch(error => {
          console.error('Failed to fetch ledger records by filters:', error);
          throw new GraphQLError('Failed to fetch ledger records');
        });
    },
  },
  Mutation: {
    regenerateLedgerRecords: async (_, { chargeIds }, context, info) => {
      // Regenerate each charge independently so a single failure surfaces as a
      // per-charge `CommonError` instead of aborting the whole batch. The single
      // regenerate button calls this with a one-element array.
      //
      // Process in bounded-concurrency chunks (rather than one big `Promise.all`)
      // so a large selection doesn't fan out every charge's loader/insert/delete
      // work at once and exhaust DB connections. Order of results is preserved.
      const results: ResolversTypes['GeneratedLedgerRecords'][] = [];
      for (let i = 0; i < chargeIds.length; i += REGENERATE_LEDGER_CONCURRENCY) {
        const chunk = chargeIds.slice(i, i + REGENERATE_LEDGER_CONCURRENCY);
        const chunkResults = await Promise.all(
          chunk.map(chargeId => regenerateSingleChargeLedgerRecords(chargeId, context, info)),
        );
        results.push(...chunkResults);
      }
      return results;
    },
    lockLedgerRecords: async (_, { date }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        const lockByRecords = injector
          .get(LedgerProvider)
          .lockLedgerRecords(date)
          .catch(e => {
            console.error(`Error locking ledger records for ${date}: ${e}`);
            throw new Error(`Error locking ledger records for ${date}`);
          });
        const lockByDate = injector
          .get(AdminContextProvider)
          .updateAdminContext({
            ownerId,
            ledgerLock: date,
          })
          .catch(e => {
            console.error(`Error locking ledger by date ${date}: ${e}`);
            throw new Error(`Error locking ledger by date ${date}`);
          });
        await Promise.all([lockByRecords, lockByDate]);

        return true;
      } catch (error) {
        console.error(`Error locking ledger for ${date}: ${error}`);
        return false;
      }
    },
  },
  LedgerRecord: {
    id: DbLedgerRecord => DbLedgerRecord.id,
    ownerId: DbLedgerRecord => DbLedgerRecord.owner_id ?? null,
    chargeId: DbLedgerRecord => DbLedgerRecord.charge_id,
    debitAmount1: DbLedgerRecord =>
      DbLedgerRecord.debit_foreign_amount1 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.debit_foreign_amount1, DbLedgerRecord.currency),
    debitAmount2: DbLedgerRecord =>
      DbLedgerRecord.debit_foreign_amount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.debit_foreign_amount2, DbLedgerRecord.currency),
    creditAmount1: DbLedgerRecord =>
      DbLedgerRecord.credit_foreign_amount1 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.credit_foreign_amount1, DbLedgerRecord.currency),
    creditAmount2: DbLedgerRecord =>
      DbLedgerRecord.credit_foreign_amount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.credit_foreign_amount2, DbLedgerRecord.currency),
    localCurrencyDebitAmount1: async (DbLedgerRecord, _, { injector }) => {
      const defaultLocalCurrency = await recordLocalCurrency(injector, DbLedgerRecord.owner_id);
      return formatFinancialAmount(DbLedgerRecord.debit_local_amount1, defaultLocalCurrency);
    },
    localCurrencyDebitAmount2: async (DbLedgerRecord, _, { injector }) => {
      const defaultLocalCurrency = await recordLocalCurrency(injector, DbLedgerRecord.owner_id);
      return DbLedgerRecord.debit_local_amount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.debit_local_amount2, defaultLocalCurrency);
    },
    localCurrencyCreditAmount1: async (DbLedgerRecord, _, { injector }) => {
      const defaultLocalCurrency = await recordLocalCurrency(injector, DbLedgerRecord.owner_id);
      return formatFinancialAmount(DbLedgerRecord.credit_local_amount1, defaultLocalCurrency);
    },
    localCurrencyCreditAmount2: async (DbLedgerRecord, _, { injector }) => {
      const defaultLocalCurrency = await recordLocalCurrency(injector, DbLedgerRecord.owner_id);
      return DbLedgerRecord.credit_local_amount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.credit_local_amount2, defaultLocalCurrency);
    },
    invoiceDate: DbLedgerRecord => DbLedgerRecord.invoice_date,
    valueDate: DbLedgerRecord => DbLedgerRecord.value_date,
    description: DbLedgerRecord => DbLedgerRecord.description ?? null,
    reference: DbLedgerRecord => DbLedgerRecord.reference1 ?? null,
  },
  Ledger: {
    records: parent => parent.records,
    balance: async (parent, _, { injector }) => {
      if (parent.balance) {
        return parent.balance;
      }
      const { ownerId, defaultLocalCurrency } = await injector
        .get(AdminContextProvider)
        .getVerifiedAdminContext();

      const financialEntitiesIds = new Set<string>();
      parent.records.map(record => {
        if (record.debit_entity1) {
          financialEntitiesIds.add(record.debit_entity1);
        }
        if (record.debit_entity2) {
          financialEntitiesIds.add(record.debit_entity2);
        }
        if (record.credit_entity1) {
          financialEntitiesIds.add(record.credit_entity1);
        }
        if (record.credit_entity2) {
          financialEntitiesIds.add(record.credit_entity2);
        }
      });

      const financialEntitiesPromise = await injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.loadMany(Array.from(financialEntitiesIds))
        .then(
          res =>
            res.filter(e => !!e && !(e instanceof Error)) as IGetFinancialEntitiesByIdsResult[],
        );
      const allowedUnbalancedBusinessesPromise = ledgerUnbalancedBusinessesByCharge(
        parent.charge,
        injector,
      );

      const [financialEntities, allowedUnbalancedBusinesses] = await Promise.all([
        financialEntitiesPromise,
        allowedUnbalancedBusinessesPromise,
      ]);

      const ledgerBalance = new Map<string, { amount: number; entityId: string }>();
      const ledgerEntries = parent.records.map(record =>
        convertLedgerRecordToProto(record, ownerId),
      );

      for (const ledgerEntry of ledgerEntries) {
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, defaultLocalCurrency);
      }

      return getLedgerBalanceInfo(
        injector,
        ledgerBalance,
        undefined,
        allowedUnbalancedBusinesses,
        financialEntities,
      );
    },
    validate: async ({ charge, records }, _, context, info) => {
      const { injector } = context;
      const { ledgerLock } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      if (await isChargeLocked(charge, injector, ledgerLock)) {
        return {
          isValid: true,
          differences: [],
          matches: records.map(r => r.id),
          errors: [],
        };
      }
      const currencyDiffErrors = await getInvoicePaymentCurrencyDiffErrors(charge, injector);

      try {
        const generated = await ledgerGenerationByCharge(
          charge,
          { insertLedgerRecordsIfNotExists: records.length === 0 },
          context,
          info,
        );
        if (!generated || 'message' in generated) {
          return {
            isValid: false,
            differences: [],
            matches: [],
            errors: [...currencyDiffErrors],
          };
        }

        const newRecords = generated.records as IGetLedgerRecordsByChargesIdsResult[];

        const fullMatching = ledgerRecordsGenerationFullMatchComparison(records, newRecords);

        if (fullMatching.isFullyMatched) {
          return {
            isValid: currencyDiffErrors.length === 0,
            differences: [],
            matches: Array.from(fullMatching.fullMatches.values()).filter(Boolean) as string[],
            errors: [...generated.errors, ...currencyDiffErrors],
          };
        }

        const { toUpdate } = ledgerRecordsGenerationPartialMatchComparison(
          fullMatching.unmatchedStorageRecords,
          fullMatching.unmatchedNewRecords,
        );

        return {
          isValid:
            fullMatching.isFullyMatched &&
            generated.errors.length === 0 &&
            currencyDiffErrors.length === 0,
          differences: toUpdate,
          matches: Array.from(fullMatching.fullMatches.values()).filter(Boolean) as string[],
          errors: [...generated.errors, ...currencyDiffErrors],
        };
      } catch (err) {
        console.error(err);
        return {
          isValid: false,
          differences: [],
          matches: [],
          errors: [...currencyDiffErrors],
        };
      }
    },
  },
  LedgerBalanceUnbalancedEntity: {
    entity: (parent, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(parent.entityId)
        .then(res => {
          if (!res) {
            throw new GraphQLError(`Financial entity with id ${parent.entityId} not found`);
          }
          return res;
        }),
    balance: parent => parent.balance,
  },
  CommonCharge: {
    ...commonChargeLedgerResolver,
  },
  FinancialCharge: {
    ...commonChargeLedgerResolver,
  },
  ConversionCharge: {
    ...commonChargeLedgerResolver,
  },
  SalaryCharge: {
    ...commonChargeLedgerResolver,
  },
  InternalTransferCharge: {
    ...commonChargeLedgerResolver,
  },
  DividendCharge: {
    ...commonChargeLedgerResolver,
  },
  BusinessTripCharge: {
    ...commonChargeLedgerResolver,
  },
  MonthlyVatCharge: {
    ...commonChargeLedgerResolver,
  },
  BankDepositCharge: {
    ...commonChargeLedgerResolver,
  },
  ForeignSecuritiesCharge: {
    ...commonChargeLedgerResolver,
  },
  CreditcardBankCharge: {
    ...commonChargeLedgerResolver,
  },
  GeneratedLedgerRecords: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Ledger';
    },
  },
  ChargeMetadata: {
    isLedgerLocked: async (DbCharge, _, { injector }) => {
      const { ledgerLock } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      return isChargeLocked(DbCharge, injector, ledgerLock);
    },
  },
};
