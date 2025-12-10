import { GraphQLError } from 'graphql';
import type {
  ProfitAndLossReportYearResolvers,
  QueryProfitAndLossReportArgs,
  ReportCommentaryRecordResolvers,
  ReportCommentarySubRecordResolvers,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '../../../../__generated__/types.js';
import { FinancialEntitiesProvider } from '../../../../modules/financial-entities/providers/financial-entities.provider.js';
import { LedgerProvider } from '../../../../modules/ledger/providers/ledger.provider.js';
import { IGetLedgerRecordsByDatesResult } from '../../../../modules/ledger/types.js';
import { amountByFinancialEntityIdAndSortCodeValidations } from '../../../../modules/reports/helpers/misc.helper.js';
import { SortCodesProvider } from '../../../../modules/sort-codes/providers/sort-codes.provider.js';
import { formatFinancialAmount } from '../../../../shared/helpers/index.js';
import {
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from '../../helpers/profit-and-loss.helper.js';

export const profitAndLossReport: ResolverFn<
  ResolversTypes['ProfitAndLossReport'],
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  RequireFields<QueryProfitAndLossReportArgs, 'referenceYears' | 'reportYear'>
> = async (_, { reportYear, referenceYears }, { injector }) => {
  referenceYears = referenceYears.filter(year => year !== reportYear);
  const years = [reportYear, ...referenceYears];
  years.map(year => {
    if (year < 2000 || year > new Date().getFullYear()) {
      throw new GraphQLError('Invalid year');
    }
  });

  const from = new Date(Math.min(...years), 0, 1);
  const to = new Date(Math.max(...years) + 1, 0, 0);
  const ledgerRecordsPromise = await injector
    .get(LedgerProvider)
    .getLedgerRecordsByDates({ fromDate: from, toDate: to });

  const financialEntitiesPromise = await injector
    .get(FinancialEntitiesProvider)
    .getAllFinancialEntities();

  const [ledgerRecords, financialEntities] = await Promise.all([
    ledgerRecordsPromise,
    financialEntitiesPromise,
  ]);

  const financialEntitiesDict = new Map(financialEntities.map(entity => [entity.id, entity]));

  const ledgerByYear = new Map<number, IGetLedgerRecordsByDatesResult[]>(
    years.map(year => [year, []]),
  );

  ledgerRecords.map(record => {
    const year = record.invoice_date.getFullYear();
    ledgerByYear.get(year)?.push(record);
  });

  const yearlyReports: ResolversParentTypes['ProfitAndLossReportYear'][] = [];
  for (const [year, ledgerRecords] of ledgerByYear) {
    const decoratedLedgerRecords = decorateLedgerRecords(ledgerRecords, financialEntitiesDict);

    const {
      revenue,
      costOfSales,
      grossProfitAmount,
      researchAndDevelopmentExpenses,
      marketingExpenses,
      managementAndGeneralExpenses,
      operatingProfitAmount,
      financialExpenses,
      otherIncome,
      profitBeforeTax,
    } = getProfitLossReportAmounts(decoratedLedgerRecords);

    const [incomeTaxAmount] = amountByFinancialEntityIdAndSortCodeValidations(
      decoratedLedgerRecords,
      [{ rule: (_, sortCode) => sortCode === 999 }],
    );

    const netProfitAmount = profitBeforeTax.amount + incomeTaxAmount;

    yearlyReports.push({
      year,
      revenue,
      costOfSales,
      grossProfit: grossProfitAmount,
      researchAndDevelopmentExpenses,
      marketingExpenses,
      managementAndGeneralExpenses,
      operatingProfit: operatingProfitAmount,
      financialExpenses,
      otherIncome,
      profitBeforeTax: profitBeforeTax.amount,
      tax: incomeTaxAmount,
      netProfit: netProfitAmount,
    });
  }

  return {
    id: `profit-and-loss-${reportYear}`,
    report: yearlyReports.find(report => report.year === reportYear)!,
    reference: yearlyReports.filter(report => report.year !== reportYear),
  };
};

export const profitAndLossReportYearMapper: ProfitAndLossReportYearResolvers = {
  id: parent => `profit-and-loss-year-${parent.year}`,
  year: parent => parent.year,
  revenue: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.revenue.amount, defaultLocalCurrency),
    records: parent.revenue.records,
  }),
  costOfSales: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.costOfSales.amount, defaultLocalCurrency),
    records: parent.costOfSales.records,
  }),
  grossProfit: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.grossProfit, defaultLocalCurrency),
  researchAndDevelopmentExpenses: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(
      parent.researchAndDevelopmentExpenses.amount,
      defaultLocalCurrency,
    ),
    records: parent.researchAndDevelopmentExpenses.records,
  }),
  marketingExpenses: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.marketingExpenses.amount, defaultLocalCurrency),
    records: parent.marketingExpenses.records,
  }),
  managementAndGeneralExpenses: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.managementAndGeneralExpenses.amount, defaultLocalCurrency),
    records: parent.managementAndGeneralExpenses.records,
  }),
  operatingProfit: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.operatingProfit, defaultLocalCurrency),
  financialExpenses: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.financialExpenses.amount, defaultLocalCurrency),
    records: parent.financialExpenses.records,
  }),
  otherIncome: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.otherIncome.amount, defaultLocalCurrency),
    records: parent.otherIncome.records,
  }),
  profitBeforeTax: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.profitBeforeTax, defaultLocalCurrency),
  tax: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.tax, defaultLocalCurrency),
  netProfit: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.netProfit, defaultLocalCurrency),
};

export const reportCommentaryRecordMapper: ReportCommentaryRecordResolvers = {
  sortCode: (parent, _, { injector }) => {
    return injector
      .get(SortCodesProvider)
      .getSortCodesByIdLoader.load(parent.sortCode)
      .then(res => {
        if (!res) {
          throw new GraphQLError(`Sort code "${parent.sortCode}" not found`);
        }
        return res;
      });
  },
  amount: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.amount, defaultLocalCurrency),
};

export const reportCommentarySubRecordMapper: ReportCommentarySubRecordResolvers = {
  financialEntity: (parent, _, { injector }) => {
    return injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByIdLoader.load(parent.financialEntityId)
      .then(res => {
        if (!res) {
          throw new GraphQLError(`Financial entity ID="${parent.financialEntityId}" not found`);
        }
        return res;
      });
  },
  amount: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.amount, defaultLocalCurrency),
};
