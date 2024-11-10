import { GraphQLError } from 'graphql';
import { Repeater } from 'graphql-yoga';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { accountant_statusArray } from '@modules/charges/types.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types.js';
import { DEFAULT_LOCAL_CURRENCY, EMPTY_UUID } from '@shared/constants';
import { ChargeSortByField, Resolvers, ResolversTypes } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import {
  ledgerGenerationByCharge,
  ledgerUnbalancedBusinessesByCharge,
} from '../helpers/ledger-by-charge-type.helper.js';
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

export const ledgerResolvers: LedgerModule.Resolvers & Pick<Resolvers, 'GeneratedLedgerRecords'> = {
  Query: {
    chargesWithLedgerChanges: (_, { filters, limit }, context, info) =>
      new Repeater<ResolversTypes['ChargesWithLedgerChangesResult']>(async (push, stop) => {
        const { injector } = context;

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

        const charges = await injector
          .get(ChargesProvider)
          .getChargesByFilters({
            ownerIds: filters?.byOwners,
            fromDate: filters?.fromDate,
            toDate: filters?.toDate,
            fromAnyDate: filters?.fromAnyDate,
            toAnyDate: filters?.toAnyDate,
            sortColumn,
            asc: filters?.sortBy?.asc !== false,
            chargeType: filters?.chargesType,
            businessIds: filters?.byBusinesses,
            withoutInvoice: filters?.withoutInvoice,
            withoutDocuments: filters?.withoutDocuments,
            withoutLedger: filters?.withoutLedger,
            tags: filters?.byTags,
            accountantStatuses: filters?.accountantStatus as accountant_statusArray | undefined,
          })
          .catch(e => {
            throw new Error(e.message);
          });

        const limitedCharges = limit ? charges.slice(0, limit) : charges;

        push({ progress: 20 });
        let handledCharges: number = 0;

        function calculateProgress() {
          return ((handledCharges * 100) / limitedCharges.length) * 0.8 + 20;
        }

        await Promise.all(
          limitedCharges.map(async charge => {
            try {
              const generatedRecordsPromise = ledgerGenerationByCharge(charge)(
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
      }) as unknown as Promise<readonly ResolversTypes['ChargesWithLedgerChangesResult'][]>,
  },
  Mutation: {
    regenerateLedgerRecords: async (_, { chargeId }, context, info) => {
      const { injector } = context;
      const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
      if (!charge) {
        throw new GraphQLError(`Charge with id ${chargeId} not found`);
      }
      try {
        const generated = await ledgerGenerationByCharge(charge)(
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

        const fullMatching = ledgerRecordsGenerationFullMatchComparison(
          storageLedgerRecords,
          records,
        );

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
          [[], []] as [
            IGetLedgerRecordsByChargesIdsResult[],
            IGetLedgerRecordsByChargesIdsResult[],
          ],
        );

        const updatePromise = injector
          .get(LedgerProvider)
          .deleteLedgerRecordsByIdLoader.loadMany(recordsToUpdate.map(r => r.id))
          .catch(e => {
            console.error(e.message);
            throw new Error(`Failed to update ledger records for charge ID="${chargeId}"`);
          })
          .then(() =>
            injector.get(LedgerProvider).insertLedgerRecords({
              ledgerRecords: recordsToUpdate
                .map(record => convertLedgerRecordToInput(record))
                .map(record => {
                  record.chargeId = chargeId;
                  return record as IInsertLedgerRecordsParams['ledgerRecords'][number];
                }),
            }),
          )
          .catch(e => {
            console.error(e.message);
            throw new Error(`Failed to update ledger records for charge ID="${chargeId}"`);
          });
        const insertPromise =
          newRecords.length > 0
            ? injector
                .get(LedgerProvider)
                .insertLedgerRecords({
                  ledgerRecords: newRecords.map(
                    convertLedgerRecordToInput,
                  ) as IInsertLedgerRecordsParams['ledgerRecords'],
                })
                .catch(e => {
                  console.error(e.message);
                  throw new Error(
                    `Failed to insert new ledger records for charge ID="${chargeId}"`,
                  );
                })
            : Promise.resolve();
        const removePromises = toRemove.map(record =>
          injector
            .get(LedgerProvider)
            .deleteLedgerRecordsByIdLoader.load(record.id)
            .catch(e => {
              console.error(e.message);
              throw new Error(`Failed to delete ledger records for charge ID="${chargeId}"`);
            }),
        );
        await Promise.all([updatePromise, insertPromise, removePromises]);

        return {
          records: toUpdate,
          charge,
          errors: generated.errors,
        };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
        };
      }
    },
  },
  LedgerRecord: {
    id: DbLedgerRecord => DbLedgerRecord.id,
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
    localCurrencyDebitAmount1: DbLedgerRecord =>
      formatFinancialAmount(DbLedgerRecord.debit_local_amount1, DEFAULT_LOCAL_CURRENCY),
    localCurrencyDebitAmount2: DbLedgerRecord =>
      DbLedgerRecord.debit_local_amount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.debit_local_amount2, DEFAULT_LOCAL_CURRENCY),
    localCurrencyCreditAmount1: DbLedgerRecord =>
      formatFinancialAmount(DbLedgerRecord.credit_local_amount1, DEFAULT_LOCAL_CURRENCY),
    localCurrencyCreditAmount2: DbLedgerRecord =>
      DbLedgerRecord.credit_local_amount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.credit_local_amount2, DEFAULT_LOCAL_CURRENCY),
    invoiceDate: DbLedgerRecord => DbLedgerRecord.invoice_date,
    valueDate: DbLedgerRecord => DbLedgerRecord.value_date,
    description: DbLedgerRecord => DbLedgerRecord.description ?? null,
    reference1: DbLedgerRecord => DbLedgerRecord.reference1 ?? null,
  },
  Ledger: {
    records: parent => parent.records,
    balance: async (parent, _, { injector }) => {
      if (parent.balance) {
        return parent.balance;
      }

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
      const ledgerEntries = parent.records.map(convertLedgerRecordToProto);

      for (const ledgerEntry of ledgerEntries) {
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      }

      return getLedgerBalanceInfo(
        injector,
        ledgerBalance,
        undefined,
        allowedUnbalancedBusinesses,
        financialEntities,
      );
    },
    validate: async ({ charge, records }, { shouldInsertLedgerInNew }, context, info) => {
      const insertLedgerRecordsIfNotExists =
        shouldInsertLedgerInNew == null ? true : shouldInsertLedgerInNew;
      try {
        const generated = await ledgerGenerationByCharge(charge)(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
        if (!generated || 'message' in generated) {
          return {
            isValid: false,
            differences: [],
            matches: [],
            errors: [],
          };
        }

        const newRecords = generated.records as IGetLedgerRecordsByChargesIdsResult[];

        const fullMatching = ledgerRecordsGenerationFullMatchComparison(records, newRecords);

        if (fullMatching.isFullyMatched) {
          return {
            isValid: true,
            differences: [],
            matches: Array.from(fullMatching.fullMatches.values()).filter(Boolean) as string[],
            errors: generated.errors,
          };
        }

        const { toUpdate } = ledgerRecordsGenerationPartialMatchComparison(
          fullMatching.unmatchedStorageRecords,
          fullMatching.unmatchedNewRecords,
        );

        return {
          isValid: fullMatching.isFullyMatched && generated.errors.length === 0,
          differences: toUpdate,
          matches: Array.from(fullMatching.fullMatches.values()).filter(Boolean) as string[],
          errors: generated.errors,
        };
      } catch (err) {
        console.error(err);
        return {
          isValid: false,
          differences: [],
          matches: [],
          errors: [],
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
  CreditcardBankCharge: {
    ...commonChargeLedgerResolver,
  },
  GeneratedLedgerRecords: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Ledger';
    },
  },
};
