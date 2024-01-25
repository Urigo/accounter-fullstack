import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { CounterAccountProto } from '@shared/types';
import {
  ledgerGenerationByCharge,
  ledgerUnbalancedBusinessesByCharge,
} from '../helpers/ledger-by-charge-type.helper.js';
import {
  convertLedgerRecordToProto,
  ledgerRecordsGenerationFullMatchComparison,
  ledgerRecordsGenerationPartialMatchComparison,
} from '../helpers/ledgrer-storage.helper.js';
import { getLedgerBalanceInfo, updateLedgerBalanceByEntry } from '../helpers/utils.helper.js';
import { LedgerProvider } from '../providers/ledger.provider.js';
import type { IGetLedgerRecordsByChargesIdsResult, LedgerModule } from '../types.js';
import { commonChargeLedgerResolver } from './common.resolver.js';
import { generateLedgerRecordsForBusinessTrip } from './ledger-generation/business-trip-ledger-generation.resolver.js';
import { generateLedgerRecordsForCommonCharge } from './ledger-generation/common-ledger-generation.resolver.js';
import { generateLedgerRecordsForConversion } from './ledger-generation/conversion-ledger-generation.resolver.js';
import { generateLedgerRecordsForDividend } from './ledger-generation/dividend-ledger-generation.resolver.js';
import { generateLedgerRecordsForInternalTransfer } from './ledger-generation/internal-transfer-ledger-generation.resolver.js';
import { generateLedgerRecordsForMonthlyVat } from './ledger-generation/monthly-vat-ledger-generation.resolver.js';
import { generateLedgerRecordsForSalary } from './ledger-generation/salary-ledger-generation.resolver.js';

export const ledgerResolvers: LedgerModule.Resolvers & Pick<Resolvers, 'GeneratedLedgerRecords'> = {
  Query: {
    validateLedgerByChargeId: async (_, { chargeId }, context, info) => {
      const { injector } = context;
      const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
      if (!charge) {
        throw new GraphQLError(`Charge with id ${chargeId} not found`);
      }
      try {
        const generated = await ledgerGenerationByCharge(charge)(charge, {}, context, info);
        if (!generated || 'message' in generated) {
          return false;
        }

        const records = generated.records as IGetLedgerRecordsByChargesIdsResult[];

        const storageLedgerRecords = await injector
          .get(LedgerProvider)
          .getLedgerRecordsByChargesIdLoader.load(chargeId);

        const fullMatching = ledgerRecordsGenerationFullMatchComparison(
          storageLedgerRecords,
          records,
        );

        if (!fullMatching.isFullyMatched) {
          const matching = ledgerRecordsGenerationPartialMatchComparison(
            fullMatching.unmatchedStorageRecords,
            fullMatching.unmatchedNewRecords,
          );
          // TODO: continue from here
          console.log('matching newly generated ledger:', matching);
        }

        return fullMatching.isFullyMatched;
      } catch (err) {
        return false;
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

      const ledgerBalance = new Map<string, { amount: number; entity: CounterAccountProto }>();
      const ledgerEntries = parent.records.map(convertLedgerRecordToProto);

      for (const ledgerEntry of ledgerEntries) {
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      }

      return getLedgerBalanceInfo(ledgerBalance, allowedUnbalancedBusinesses, financialEntities);
    },
    validate: async ({ charge }, _, context, info) => {
      const { injector } = context;

      try {
        const generated = await ledgerGenerationByCharge(charge)(charge, {}, context, info);
        if (!generated || 'message' in generated) {
          return {
            isValid: false,
            differences: [],
            matches: [],
          };
        }

        const records = generated.records as IGetLedgerRecordsByChargesIdsResult[];

        const storageLedgerRecords = await injector
          .get(LedgerProvider)
          .getLedgerRecordsByChargesIdLoader.load(charge.id);

        const fullMatching = ledgerRecordsGenerationFullMatchComparison(
          storageLedgerRecords,
          records,
        );

        if (fullMatching.isFullyMatched) {
          return {
            isValid: true,
            differences: [],
            matches: Array.from(fullMatching.fullMatches.values()).filter(Boolean),
          };
        }

        const differences = ledgerRecordsGenerationPartialMatchComparison(
          fullMatching.unmatchedStorageRecords,
          fullMatching.unmatchedNewRecords,
        );

        return {
          isValid: fullMatching.isFullyMatched,
          differences,
          matches: Array.from(fullMatching.fullMatches.values()).filter(Boolean),
        };
      } catch (err) {
        return {
          isValid: false,
          differences: [],
          matches: [],
        };
      }
    },
  },
  LedgerBalanceUnbalancedEntity: {
    entity: (parent, _, { injector }) =>
      typeof parent.entity === 'string'
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(parent.entity)
            .then(res => {
              if (!res) {
                throw new GraphQLError(`Financial entity with id ${parent.entity} not found`);
              }
              return res;
            })
        : parent.entity,
    balance: parent => parent.balance,
  },
  CommonCharge: {
    ...commonChargeLedgerResolver,
    generatedLedgerRecords: generateLedgerRecordsForCommonCharge,
  },
  ConversionCharge: {
    ...commonChargeLedgerResolver,
    generatedLedgerRecords: generateLedgerRecordsForConversion,
  },
  SalaryCharge: {
    ...commonChargeLedgerResolver,
    generatedLedgerRecords: generateLedgerRecordsForSalary,
  },
  InternalTransferCharge: {
    ...commonChargeLedgerResolver,
    generatedLedgerRecords: generateLedgerRecordsForInternalTransfer,
  },
  DividendCharge: {
    ...commonChargeLedgerResolver,
    generatedLedgerRecords: generateLedgerRecordsForDividend,
  },
  BusinessTripCharge: {
    ...commonChargeLedgerResolver,
    generatedLedgerRecords: generateLedgerRecordsForBusinessTrip,
  },
  MonthlyVatCharge: {
    ...commonChargeLedgerResolver,
    generatedLedgerRecords: generateLedgerRecordsForMonthlyVat,
  },
  GeneratedLedgerRecords: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Ledger';
    },
  },
};
