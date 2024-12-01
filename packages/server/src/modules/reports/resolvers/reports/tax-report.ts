import { GraphQLError } from 'graphql';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  QueryTaxReportArgs,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
  TaxReportYearResolvers,
} from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import {
  DecoratedLedgerRecord,
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from '../../helpers/profit-and-loss.helper.js';
import { calculateTaxAmounts } from '../../helpers/tax.helper.js';

export const taxReport: ResolverFn<
  ResolversTypes['TaxReport'],
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  RequireFields<QueryTaxReportArgs, 'referenceYears' | 'reportYear'>
> = async (_, { reportYear, referenceYears }, { injector }) => {
  referenceYears = referenceYears.filter(year => year !== reportYear);
  const years = [reportYear, ...referenceYears];
  years.map(year => {
    if (year < 2000 || year > new Date().getFullYear()) {
      throw new GraphQLError('Invalid year');
    }
  });

  const from = new Date(Math.min(...years) - 2, 0, 1, 0, 0, 0, 1); // Note: take 2 years before the earliest year requested, to calculate R&D spread over 3 years
  const to = new Date(Math.max(...years) + 1, 0, 0);
  const ledgerRecords = await injector
    .get(LedgerProvider)
    .getLedgerRecordsByDates({ fromDate: from, toDate: to });

  const financialEntities = await injector.get(FinancialEntitiesProvider).getAllFinancialEntities();

  const financialEntitiesDict = new Map(financialEntities.map(entity => [entity.id, entity]));

  const decoratedLedgerByYear = new Map<number, DecoratedLedgerRecord[]>();
  for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
    if (from.getFullYear() > to.getFullYear()) {
      break;
    }

    decoratedLedgerByYear.set(year, []);
  }

  ledgerRecords.map(record => {
    const year = record.invoice_date.getFullYear();
    const [decoratedRecord] = decorateLedgerRecords([record], financialEntitiesDict);
    decoratedLedgerByYear.get(year)?.push(decoratedRecord);
  });

  const profitLossByYear = new Map<number, ReturnType<typeof getProfitLossReportAmounts>>();

  const yearlyReports: ResolversParentTypes['TaxReportYear'][] = [];
  for (const year of years) {
    const decoratedLedgerRecords = decoratedLedgerByYear.get(year) ?? [];

    const profitLossReportAmounts =
      profitLossByYear.get(year) ?? getProfitLossReportAmounts(decoratedLedgerRecords);

    const {
      profitBeforeTaxAmount,
      profitBeforeTaxRecords,
      researchAndDevelopmentExpensesAmount,
      researchAndDevelopmentExpensesRecords,
    } = profitLossReportAmounts;

    let cumulativeResearchAndDevelopmentExpensesAmount = 0;
    for (const rndYear of [year - 2, year - 1, year]) {
      let profitLossHelperReportAmounts = profitLossByYear.get(rndYear);
      if (!profitLossHelperReportAmounts) {
        const rndDecoratedLedgerRecords = decoratedLedgerByYear.get(rndYear) ?? [];
        profitLossHelperReportAmounts = getProfitLossReportAmounts(rndDecoratedLedgerRecords);
      }

      cumulativeResearchAndDevelopmentExpensesAmount +=
        profitLossHelperReportAmounts.researchAndDevelopmentExpensesAmount;
    }

    const {
      researchAndDevelopmentExpensesForTax,
      taxableIncomeAmount,
      taxRate,
      annualTaxExpenseAmount,
    } = await calculateTaxAmounts(
      injector,
      year,
      decoratedLedgerRecords,
      cumulativeResearchAndDevelopmentExpensesAmount,
      profitBeforeTaxAmount,
    );

    yearlyReports.push({
      year,
      profitBeforeTax: {
        amount: profitBeforeTaxAmount,
        records: profitBeforeTaxRecords,
      },
      researchAndDevelopmentExpensesByRecords: {
        amount: researchAndDevelopmentExpensesAmount,
        records: researchAndDevelopmentExpensesRecords,
      },
      researchAndDevelopmentExpensesForTax,

      taxableIncome: taxableIncomeAmount,
      taxRate,
      annualTaxExpense: annualTaxExpenseAmount,
    });
  }

  return {
    id: `tax-report-${reportYear}`,
    report: yearlyReports.find(report => report.year === reportYear)!,
    reference: yearlyReports.filter(report => report.year !== reportYear),
  };
};

export const taxReportYearMapper: TaxReportYearResolvers = {
  id: parent => `profit-and-loss-year-${parent.year}`,
  year: parent => parent.year,
  profitBeforeTax: parent => ({
    amount: formatFinancialAmount(parent.profitBeforeTax.amount, DEFAULT_LOCAL_CURRENCY),
    records: parent.profitBeforeTax.records,
  }),
  researchAndDevelopmentExpensesByRecords: parent => ({
    amount: formatFinancialAmount(
      parent.researchAndDevelopmentExpensesByRecords.amount,
      DEFAULT_LOCAL_CURRENCY,
    ),
    records: parent.researchAndDevelopmentExpensesByRecords.records,
  }),
  researchAndDevelopmentExpensesForTax: parent =>
    formatFinancialAmount(parent.researchAndDevelopmentExpensesForTax, DEFAULT_LOCAL_CURRENCY),
  taxableIncome: parent => formatFinancialAmount(parent.taxableIncome, DEFAULT_LOCAL_CURRENCY),
  taxRate: parent => parent.taxRate,
  annualTaxExpense: parent =>
    formatFinancialAmount(parent.annualTaxExpense, DEFAULT_LOCAL_CURRENCY),
};
