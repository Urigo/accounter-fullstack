import { GraphQLError } from 'graphql';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { IGetLedgerRecordsByDatesResult } from '@modules/ledger/types.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  QueryTaxReportArgs,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
  TaxReport,
} from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import {
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from '../../helpers/profit-and-loss.helper.js';
import { calculateTaxAmounts } from '../../helpers/tax.helper.js';

export const taxReport: ResolverFn<
  ReadonlyArray<ResolversTypes['TaxReport']>,
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  RequireFields<QueryTaxReportArgs, 'years'>
> = async (_, { years }, { injector }) => {
  years.map(year => {
    if (year < 2000 || year > new Date().getFullYear()) {
      throw new GraphQLError('Invalid year');
    }
  });

  const from = new Date(Math.min(...years), 0, 1);
  const to = new Date(Math.max(...years) + 1, 0, 0);
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

  const financialEntitiesDict = new Map(financialEntities.map(entity => [entity.id, entity]));

  const ledgerByYear = new Map<number, IGetLedgerRecordsByDatesResult[]>(
    years.map(year => [year, []]),
  );

  ledgerRecords.map(record => {
    const year = record.invoice_date.getFullYear();
    ledgerByYear.get(year)?.push(record);
  });

  const yearlyReports: TaxReport[] = [];
  for (const [year, ledgerRecords] of ledgerByYear) {
    const decoratedLedgerRecords = decorateLedgerRecords(ledgerRecords, financialEntitiesDict);

    const { researchAndDevelopmentExpensesAmount, profitBeforeTaxAmount } =
      getProfitLossReportAmounts(decoratedLedgerRecords);

    const {
      researchAndDevelopmentExpensesForTax,
      depreciationForTax,
      taxableIncomeAmount,
      taxRate,
      annualTaxExpenseAmount,
    } = await calculateTaxAmounts(
      injector,
      year,
      researchAndDevelopmentExpensesAmount,
      profitBeforeTaxAmount,
    );

    yearlyReports.push({
      year,
      profitBeforeTax: formatFinancialAmount(profitBeforeTaxAmount, DEFAULT_LOCAL_CURRENCY),
      researchAndDevelopmentExpensesByRecords: formatFinancialAmount(
        researchAndDevelopmentExpensesAmount,
        DEFAULT_LOCAL_CURRENCY,
      ),
      researchAndDevelopmentExpensesForTax: formatFinancialAmount(
        researchAndDevelopmentExpensesForTax,
        DEFAULT_LOCAL_CURRENCY,
      ),

      depreciationForTax: formatFinancialAmount(depreciationForTax, DEFAULT_LOCAL_CURRENCY),
      taxableIncome: formatFinancialAmount(taxableIncomeAmount, DEFAULT_LOCAL_CURRENCY),
      taxRate,
      annualTaxExpense: formatFinancialAmount(annualTaxExpenseAmount, DEFAULT_LOCAL_CURRENCY),
    });
  }

  return yearlyReports.sort((a, b) => a.year - b.year);
};
