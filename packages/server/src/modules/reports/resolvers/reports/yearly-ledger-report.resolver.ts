import { GraphQLError } from 'graphql';
import type {
  FinancialAmount,
  QueryYearlyLedgerReportArgs,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
  SingleSidedLedgerRecord,
} from '../../../../__generated__/types.js';
import { FinancialEntitiesProvider } from '../../../../modules/financial-entities/providers/financial-entities.provider.js';
import type {
  IGetAllFinancialEntitiesResult,
  IGetFinancialEntitiesByIdsResult,
} from '../../../../modules/financial-entities/types.js';
import { LedgerProvider } from '../../../../modules/ledger/providers/ledger.provider.js';
import { formatFinancialAmount } from '../../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { sortEntityRecordsAndAddBalance } from '../../helpers/yearly-ledger-report.helper.js';

export const yearlyLedgerReport: ResolverFn<
  ResolversTypes['YearlyLedgerReport'],
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  RequireFields<QueryYearlyLedgerReportArgs, 'year'>
> = async (_, { year }, { injector, adminContext }) => {
  const financialEntitiesPromise = injector
    .get(FinancialEntitiesProvider)
    .getAllFinancialEntities();
  const ledgerRecordsPromise = injector.get(LedgerProvider).getLedgerRecordsByDates({
    fromDate: `${year}-01-01` as TimelessDateString,
    toDate: `${year}-12-31` as TimelessDateString,
    ownerId: adminContext.defaultAdminBusinessId,
  });
  const ledgerOpeningBalance = injector
    .get(LedgerProvider)
    .getLedgerBalanceToDate(`${year - 1}-12-31` as TimelessDateString);

  const [financialEntities, ledgerRecords, ledgerBalance] = await Promise.all([
    financialEntitiesPromise,
    ledgerRecordsPromise,
    ledgerOpeningBalance,
  ]);

  const financialEntitiesMap = new Map(financialEntities.map(entity => [entity.id, entity]));

  const financialEntityInfoMap = new Map<
    string,
    {
      entity: IGetAllFinancialEntitiesResult;
      records: (Omit<SingleSidedLedgerRecord, 'counterParty' | 'balance'> & {
        counterParty?: IGetFinancialEntitiesByIdsResult;
      })[];
      openingBalance: FinancialAmount;
    }
  >();

  for (const record of ledgerRecords) {
    const ledgerRecordBalance = Math.abs(
      Number(record.credit_local_amount1 ?? '0') +
        Number(record.credit_local_amount2 ?? '0') -
        Number(record.debit_local_amount1 ?? '0') -
        Number(record.debit_local_amount2 ?? '0'),
    );
    if (ledgerRecordBalance > 0.005) {
      throw new GraphQLError(`Ledger record is not balanced (ID: ${record.id})`);
    }

    if (
      record.debit_entity1 &&
      record.debit_entity2 &&
      record.credit_entity1 &&
      record.credit_entity2
    ) {
      throw new GraphQLError(`Ledger record has more than 3 entities (ID: ${record.id})`);
    }

    const debit1FinancialEntity = financialEntitiesMap.get(record.debit_entity1 ?? '');
    const debit2FinancialEntity = financialEntitiesMap.get(record.debit_entity2 ?? '');
    const credit1FinancialEntity = financialEntitiesMap.get(record.credit_entity1 ?? '');
    const credit2FinancialEntity = financialEntitiesMap.get(record.credit_entity2 ?? '');

    if (record.debit_entity1) {
      if (!debit1FinancialEntity) {
        throw new Error(`Financial entity ${record.debit_entity1} not found`);
      }

      let financialEntityInfo = financialEntityInfoMap.get(debit1FinancialEntity.id);

      if (!financialEntityInfo) {
        financialEntityInfo = {
          entity: debit1FinancialEntity,
          openingBalance: formatFinancialAmount(
            Number(ledgerBalance.find(r => r.entity_id === debit1FinancialEntity.id)?.sum ?? '0'),
            adminContext.defaultLocalCurrency,
          ),
          records: [],
        };
        financialEntityInfoMap.set(debit1FinancialEntity.id, financialEntityInfo);
      }

      const amount = Number(record.debit_local_amount1 ?? '0') * -1;

      const coreInfo: Omit<
        SingleSidedLedgerRecord,
        'amount' | 'localCurrencyAmount' | 'counterParty' | 'balance'
      > = {
        id: record.id,
        invoiceDate: record.invoice_date,
        valueDate: record.value_date,
        description: record.description,
        reference: record.reference1,
      };

      const entityRecord: Omit<SingleSidedLedgerRecord, 'counterParty' | 'balance'> & {
        counterParty?: IGetFinancialEntitiesByIdsResult;
      } = {
        ...coreInfo,
        id: `${record.id}-debit1`,
        amount: formatFinancialAmount(amount, adminContext.defaultLocalCurrency),
        counterParty: credit1FinancialEntity,
      };

      financialEntityInfo.records.push(entityRecord);
    }

    if (record.debit_entity2) {
      if (!debit2FinancialEntity) {
        throw new Error(`Financial entity ${record.debit_entity2} not found`);
      }

      let financialEntityInfo = financialEntityInfoMap.get(debit2FinancialEntity.id);

      if (!financialEntityInfo) {
        financialEntityInfo = {
          entity: debit2FinancialEntity,
          openingBalance: formatFinancialAmount(
            Number(ledgerBalance.find(r => r.entity_id === debit2FinancialEntity.id)?.sum ?? '0'),
            adminContext.defaultLocalCurrency,
          ),
          records: [],
        };
        financialEntityInfoMap.set(debit2FinancialEntity.id, financialEntityInfo);
      }

      const amount = Number(record.debit_local_amount2 ?? '0') * -1;

      const coreInfo: Omit<
        SingleSidedLedgerRecord,
        'amount' | 'localCurrencyAmount' | 'counterParty' | 'balance'
      > = {
        id: record.id,
        invoiceDate: record.invoice_date,
        valueDate: record.value_date,
        description: record.description,
        reference: record.reference1,
      };

      const entityRecord: Omit<SingleSidedLedgerRecord, 'balance' | 'counterParty'> & {
        counterParty?: IGetAllFinancialEntitiesResult;
      } = {
        ...coreInfo,
        id: `${record.id}-debit2`,
        amount: formatFinancialAmount(amount, adminContext.defaultLocalCurrency),
        counterParty: credit1FinancialEntity,
      };

      financialEntityInfo.records.push(entityRecord);
    }

    if (record.credit_entity1) {
      if (!credit1FinancialEntity) {
        throw new Error(`Financial entity ${record.credit_entity1} not found`);
      }

      let financialEntityInfo = financialEntityInfoMap.get(credit1FinancialEntity.id);

      if (!financialEntityInfo) {
        financialEntityInfo = {
          entity: credit1FinancialEntity,
          openingBalance: formatFinancialAmount(
            Number(ledgerBalance.find(r => r.entity_id === credit1FinancialEntity.id)?.sum ?? '0'),
            adminContext.defaultLocalCurrency,
          ),
          records: [],
        };
        financialEntityInfoMap.set(credit1FinancialEntity.id, financialEntityInfo);
      }

      const amount = Number(record.credit_local_amount1 ?? '0');

      const coreInfo: Omit<
        SingleSidedLedgerRecord,
        'amount' | 'localCurrencyAmount' | 'counterParty' | 'balance'
      > = {
        id: record.id,
        invoiceDate: record.invoice_date,
        valueDate: record.value_date,
        description: record.description,
        reference: record.reference1,
      };

      const entityRecord: Omit<SingleSidedLedgerRecord, 'balance' | 'counterParty'> & {
        counterParty?: IGetAllFinancialEntitiesResult;
      } = {
        ...coreInfo,
        id: `${record.id}-credit1`,
        amount: formatFinancialAmount(amount, adminContext.defaultLocalCurrency),
        counterParty: debit1FinancialEntity,
      };

      financialEntityInfo.records.push(entityRecord);
    }

    if (record.credit_entity2) {
      if (!credit2FinancialEntity) {
        throw new Error(`Financial entity ${record.credit_entity2} not found`);
      }

      let financialEntityInfo = financialEntityInfoMap.get(credit2FinancialEntity.id);

      if (!financialEntityInfo) {
        financialEntityInfo = {
          entity: credit2FinancialEntity,
          openingBalance: formatFinancialAmount(
            Number(ledgerBalance.find(r => r.entity_id === credit2FinancialEntity.id)?.sum ?? '0'),
            adminContext.defaultLocalCurrency,
          ),
          records: [],
        };
        financialEntityInfoMap.set(credit2FinancialEntity.id, financialEntityInfo);
      }

      const amount = Number(record.credit_local_amount2 ?? '0');

      const coreInfo: Omit<SingleSidedLedgerRecord, 'amount' | 'counterParty' | 'balance'> = {
        id: record.id,
        invoiceDate: record.invoice_date,
        valueDate: record.value_date,
        description: record.description,
        reference: record.reference1,
      };

      const entityRecord: Omit<SingleSidedLedgerRecord, 'counterParty' | 'balance'> & {
        counterParty?: IGetFinancialEntitiesByIdsResult;
      } = {
        ...coreInfo,
        id: `${record.id}-credit2`,
        amount: formatFinancialAmount(amount, adminContext.defaultLocalCurrency),
        counterParty: debit1FinancialEntity,
      };

      financialEntityInfo.records.push(entityRecord);
    }
  }
  const report: ResolversTypes['YearlyLedgerReport'] = {
    id: `${year}-ledger-report`,
    year,
    financialEntitiesInfo: Array.from(financialEntityInfoMap.values())
      .map(({ entity, openingBalance, records: unsortedRecords }) => {
        const records = sortEntityRecordsAndAddBalance(openingBalance.raw, unsortedRecords);
        let totalCreditAmount = 0;
        let totalDebitAmount = 0;
        records.map(r => {
          if (r.amount.raw > 0) {
            totalCreditAmount += r.amount.raw;
          } else {
            totalDebitAmount -= r.amount.raw;
          }
        });
        const closingBalance = formatFinancialAmount(
          records[records.length - 1].balance,
          adminContext.defaultLocalCurrency,
        );
        return {
          entity,
          openingBalance,
          totalCredit: formatFinancialAmount(totalCreditAmount, adminContext.defaultLocalCurrency),
          totalDebit: formatFinancialAmount(totalDebitAmount, adminContext.defaultLocalCurrency),
          closingBalance,
          records: sortEntityRecordsAndAddBalance(openingBalance.raw, records),
        };
      })
      .sort((a, b) => {
        const diff = (a.entity.sort_code ?? 0) - (b.entity.sort_code ?? 0);
        if (diff === 0) {
          return a.entity.name.localeCompare(b.entity.name);
        }
        return diff;
      }),
  };

  return report;
};
