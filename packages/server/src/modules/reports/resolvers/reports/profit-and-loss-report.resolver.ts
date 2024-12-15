import { GraphQLError } from 'graphql';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { IGetLedgerRecordsByDatesResult } from '@modules/ledger/types.js';
import { SortCodesProvider } from '@modules/sort-codes/providers/sort-codes.provider.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  ProfitAndLossReportYearResolvers,
  QueryProfitAndLossReportArgs,
  ReportCommentaryRecordResolvers,
  ReportCommentarySubRecordResolvers,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import {
  amountBySortCodeValidation,
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
  const ledgerRecords = await injector
    .get(LedgerProvider)
    .getLedgerRecordsByDates({ fromDate: from, toDate: to });

  const financialEntities = await injector.get(FinancialEntitiesProvider).getAllFinancialEntities();

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
      revenueAmount,
      revenueRecords,
      costOfSalesAmount,
      costOfSalesRecords,
      grossProfitAmount,
      researchAndDevelopmentExpensesAmount,
      researchAndDevelopmentExpensesRecords,
      marketingExpensesAmount,
      marketingExpensesRecords,
      managementAndGeneralExpensesAmount,
      managementAndGeneralExpensesRecords,
      operatingProfitAmount,
      financialExpensesAmount,
      financialExpensesRecords,
      otherIncomeAmount,
      otherIncomeRecords,
      profitBeforeTaxAmount,
    } = getProfitLossReportAmounts(decoratedLedgerRecords);

    const { amount: incomeTaxAmount } = amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => sortCode === 999,
    );

    const netProfitAmount = profitBeforeTaxAmount + incomeTaxAmount;

    yearlyReports.push({
      year,
      revenue: {
        amount: revenueAmount,
        records: revenueRecords,
      },
      costOfSales: {
        amount: costOfSalesAmount,
        records: costOfSalesRecords,
      },
      grossProfit: grossProfitAmount,
      researchAndDevelopmentExpenses: {
        amount: researchAndDevelopmentExpensesAmount,
        records: researchAndDevelopmentExpensesRecords,
      },
      marketingExpenses: {
        amount: marketingExpensesAmount,
        records: marketingExpensesRecords,
      },
      managementAndGeneralExpenses: {
        amount: managementAndGeneralExpensesAmount,
        records: managementAndGeneralExpensesRecords,
      },
      operatingProfit: operatingProfitAmount,
      financialExpenses: {
        amount: financialExpensesAmount,
        records: financialExpensesRecords,
      },
      otherIncome: {
        amount: otherIncomeAmount,
        records: otherIncomeRecords,
      },
      profitBeforeTax: profitBeforeTaxAmount,
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
  revenue: parent => ({
    amount: formatFinancialAmount(parent.revenue.amount, DEFAULT_LOCAL_CURRENCY),
    records: parent.revenue.records,
  }),
  costOfSales: parent => ({
    amount: formatFinancialAmount(parent.costOfSales.amount, DEFAULT_LOCAL_CURRENCY),
    records: parent.costOfSales.records,
  }),
  grossProfit: parent => formatFinancialAmount(parent.grossProfit, DEFAULT_LOCAL_CURRENCY),
  researchAndDevelopmentExpenses: parent => ({
    amount: formatFinancialAmount(
      parent.researchAndDevelopmentExpenses.amount,
      DEFAULT_LOCAL_CURRENCY,
    ),
    records: parent.researchAndDevelopmentExpenses.records,
  }),
  marketingExpenses: parent => ({
    amount: formatFinancialAmount(parent.marketingExpenses.amount, DEFAULT_LOCAL_CURRENCY),
    records: parent.marketingExpenses.records,
  }),
  managementAndGeneralExpenses: parent => ({
    amount: formatFinancialAmount(
      parent.managementAndGeneralExpenses.amount,
      DEFAULT_LOCAL_CURRENCY,
    ),
    records: parent.managementAndGeneralExpenses.records,
  }),
  operatingProfit: parent => formatFinancialAmount(parent.operatingProfit, DEFAULT_LOCAL_CURRENCY),
  financialExpenses: parent => ({
    amount: formatFinancialAmount(parent.financialExpenses.amount, DEFAULT_LOCAL_CURRENCY),
    records: parent.financialExpenses.records,
  }),
  otherIncome: parent => ({
    amount: formatFinancialAmount(parent.otherIncome.amount, DEFAULT_LOCAL_CURRENCY),
    records: parent.otherIncome.records,
  }),
  profitBeforeTax: parent => formatFinancialAmount(parent.profitBeforeTax, DEFAULT_LOCAL_CURRENCY),
  tax: parent => formatFinancialAmount(parent.tax, DEFAULT_LOCAL_CURRENCY),
  netProfit: parent => formatFinancialAmount(parent.netProfit, DEFAULT_LOCAL_CURRENCY),
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
  amount: parent => formatFinancialAmount(parent.amount, DEFAULT_LOCAL_CURRENCY),
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
  amount: parent => formatFinancialAmount(parent.amount, DEFAULT_LOCAL_CURRENCY),
};
