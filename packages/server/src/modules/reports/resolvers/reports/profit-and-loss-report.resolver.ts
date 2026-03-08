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
import { formatFinancialAmount } from '../../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { FinancialEntitiesProvider } from '../../../financial-entities/providers/financial-entities.provider.js';
import { LedgerProvider } from '../../../ledger/providers/ledger.provider.js';
import { IGetLedgerRecordsByDatesResult } from '../../../ledger/types.js';
import { SortCodesProvider } from '../../../sort-codes/providers/sort-codes.provider.js';
import { amountByFinancialEntityIdAndSortCodeValidations } from '../../helpers/misc.helper.js';
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
  revenue: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return {
      amount: formatFinancialAmount(parent.revenue.amount, defaultLocalCurrency),
      records: parent.revenue.records,
    };
  },
  costOfSales: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return {
      amount: formatFinancialAmount(parent.costOfSales.amount, defaultLocalCurrency),
      records: parent.costOfSales.records,
    };
  },
  grossProfit: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();

    return formatFinancialAmount(parent.grossProfit, defaultLocalCurrency);
  },
  researchAndDevelopmentExpenses: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return {
      amount: formatFinancialAmount(
        parent.researchAndDevelopmentExpenses.amount,
        defaultLocalCurrency,
      ),
      records: parent.researchAndDevelopmentExpenses.records,
    };
  },
  marketingExpenses: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return {
      amount: formatFinancialAmount(parent.marketingExpenses.amount, defaultLocalCurrency),
      records: parent.marketingExpenses.records,
    };
  },
  managementAndGeneralExpenses: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return {
      amount: formatFinancialAmount(
        parent.managementAndGeneralExpenses.amount,
        defaultLocalCurrency,
      ),
      records: parent.managementAndGeneralExpenses.records,
    };
  },
  operatingProfit: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return formatFinancialAmount(parent.operatingProfit, defaultLocalCurrency);
  },
  financialExpenses: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return {
      amount: formatFinancialAmount(parent.financialExpenses.amount, defaultLocalCurrency),
      records: parent.financialExpenses.records,
    };
  },
  otherIncome: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return {
      amount: formatFinancialAmount(parent.otherIncome.amount, defaultLocalCurrency),
      records: parent.otherIncome.records,
    };
  },
  profitBeforeTax: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return formatFinancialAmount(parent.profitBeforeTax, defaultLocalCurrency);
  },
  tax: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return formatFinancialAmount(parent.tax, defaultLocalCurrency);
  },
  netProfit: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return formatFinancialAmount(parent.netProfit, defaultLocalCurrency);
  },
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
  amount: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return formatFinancialAmount(parent.amount, defaultLocalCurrency);
  },
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
  amount: async (parent, _, { injector }) => {
    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    return formatFinancialAmount(parent.amount, defaultLocalCurrency);
  },
};
