import { GraphQLError } from 'graphql';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  QueryProfitAndLossReportArgs,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';

export const profitAndLossReport: ResolverFn<
  ResolversTypes['ProfitAndLossReport'],
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  RequireFields<QueryProfitAndLossReportArgs, 'year'>
> = async (_, { year }, { injector }) => {
  if (year < 2000 || year > new Date().getFullYear()) {
    throw new GraphQLError('Invalid year');
  }

  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 0);
  const ledgerRecords = await injector
    .get(LedgerProvider)
    .getLedgerRecordsByDates({ fromDate: from, toDate: to });

  const financialEntitiesIds = new Set(
    ledgerRecords
      .map(record => [
        record.credit_entity1,
        record.credit_entity2,
        record.debit_entity1,
        record.debit_entity2,
      ])
      .flat()
      .filter(Boolean) as string[],
  );
  const financialEntities = (await injector
    .get(FinancialEntitiesProvider)
    .getFinancialEntityByIdLoader.loadMany(Array.from(financialEntitiesIds))
    .then(res =>
      res.filter(entity => {
        if (!entity) {
          return false;
        }
        if (entity instanceof Error) {
          throw entity;
        }
        return true;
      }),
    )) as IGetFinancialEntitiesByIdsResult[];

  const revenueFinancialEntitiesIds = financialEntities
    .filter(entity => entity.sort_code && Math.floor(entity.sort_code / 100) === 8)
    .map(entity => entity.id);

  let revenueSum = 0;
  ledgerRecords.map(record => {
    if (record.credit_entity1 && revenueFinancialEntitiesIds.includes(record.credit_entity1)) {
      revenueSum += Number(record.credit_local_amount1);
    }
    if (record.credit_entity2 && revenueFinancialEntitiesIds.includes(record.credit_entity2)) {
      revenueSum += Number(record.credit_local_amount2);
    }
    if (record.debit_entity1 && revenueFinancialEntitiesIds.includes(record.debit_entity1)) {
      revenueSum -= Number(record.debit_local_amount1);
    }
    if (record.debit_entity2 && revenueFinancialEntitiesIds.includes(record.debit_entity2)) {
      revenueSum -= Number(record.debit_local_amount2);
    }
  });

  //   untaxable expenses:
  //     gifts over 190 ILS per gift
  //     fines
  //     a portion of the salary expenses of Uri&Dotan - a report from accounting
  //     R&D expenses - spread over 3 years

  return {
    revenue: formatFinancialAmount(revenueSum, DEFAULT_LOCAL_CURRENCY),
    costOfSales: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    grossProfit: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    operatingExpenses: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    operatingProfit: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    otherIncome: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    otherExpenses: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    profitBeforeTax: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    tax: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    netProfit: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
  };
};
