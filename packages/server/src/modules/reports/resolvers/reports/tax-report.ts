import { GraphQLError } from 'graphql';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
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
> = async (_, { reportYear, referenceYears }, context) => {
  const { injector } = context;
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

    let profitAndLoss = profitLossByYear.get(year);
    if (!profitAndLoss) {
      profitAndLoss = getProfitLossReportAmounts(decoratedLedgerRecords);
      profitLossByYear.set(year, profitAndLoss);
    }

    const {
      profitBeforeTaxAmount,
      profitBeforeTaxRecords,
      researchAndDevelopmentExpensesAmount,
      researchAndDevelopmentExpensesRecords,
    } = profitAndLoss;

    const adjustedResearchAndDevelopmentExpensesAmount = researchAndDevelopmentExpensesAmount * -1;

    let cumulativeResearchAndDevelopmentExpensesAmount = 0;
    for (const rndYear of [year - 2, year - 1, year]) {
      let profitLossHelperReportAmounts = profitLossByYear.get(rndYear);
      if (!profitLossHelperReportAmounts) {
        const rndDecoratedLedgerRecords = decoratedLedgerByYear.get(rndYear) ?? [];
        profitLossHelperReportAmounts = getProfitLossReportAmounts(rndDecoratedLedgerRecords);
        profitLossByYear.set(rndYear, profitLossHelperReportAmounts);
      }

      cumulativeResearchAndDevelopmentExpensesAmount +=
        profitLossHelperReportAmounts.researchAndDevelopmentExpensesAmount;
    }

    const taxableCumulativeResearchAndDevelopmentExpensesAmount =
      cumulativeResearchAndDevelopmentExpensesAmount / 3;

    const {
      researchAndDevelopmentExpensesForTax,
      fines,
      untaxableGifts,
      businessTripsExcessExpensesAmount,
      salaryExcessExpensesAmount,
      reserves,
      nontaxableLinkage,
      taxableIncomeAmount,
      taxRate,
      specialTaxableIncome,
      specialTaxRate,
      annualTaxExpenseAmount,
    } = await calculateTaxAmounts(
      context,
      year,
      decoratedLedgerRecords,
      adjustedResearchAndDevelopmentExpensesAmount,
      taxableCumulativeResearchAndDevelopmentExpensesAmount,
      profitBeforeTaxAmount,
    );

    yearlyReports.push({
      year,
      profitBeforeTax: {
        amount: profitBeforeTaxAmount,
        records: profitBeforeTaxRecords,
      },
      researchAndDevelopmentExpensesByRecords: {
        amount: adjustedResearchAndDevelopmentExpensesAmount,
        records: researchAndDevelopmentExpensesRecords.map(record => ({
          ...record,
          amount: record.amount * -1,
          records: record.records.map(subRecord => ({
            ...subRecord,
            amount: subRecord.amount * -1,
          })),
        })),
      },
      researchAndDevelopmentExpensesForTax,
      fines,
      untaxableGifts,
      businessTripsExcessExpensesAmount,
      salaryExcessExpensesAmount,
      reserves,
      nontaxableLinkage,

      taxableIncome: taxableIncomeAmount,
      taxRate,
      specialTaxableIncome,
      specialTaxRate,
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
  profitBeforeTax: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.profitBeforeTax.amount, defaultLocalCurrency),
    records: parent.profitBeforeTax.records,
  }),
  researchAndDevelopmentExpensesByRecords: (
    parent,
    _,
    { adminContext: { defaultLocalCurrency } },
  ) => ({
    amount: formatFinancialAmount(
      parent.researchAndDevelopmentExpensesByRecords.amount,
      defaultLocalCurrency,
    ),
    records: parent.researchAndDevelopmentExpensesByRecords.records,
  }),
  researchAndDevelopmentExpensesForTax: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.researchAndDevelopmentExpensesForTax, defaultLocalCurrency),

  fines: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.fines.amount, defaultLocalCurrency),
    records: parent.fines.records,
  }),
  untaxableGifts: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.untaxableGifts.amount, defaultLocalCurrency),
    records: parent.untaxableGifts.records,
  }),
  businessTripsExcessExpensesAmount: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.businessTripsExcessExpensesAmount, defaultLocalCurrency),
  salaryExcessExpensesAmount: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.salaryExcessExpensesAmount, defaultLocalCurrency),
  reserves: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.reserves.amount, defaultLocalCurrency),
    records: parent.reserves.records,
  }),
  nontaxableLinkage: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.nontaxableLinkage.amount, defaultLocalCurrency),
    records: parent.nontaxableLinkage.records,
  }),
  taxableIncome: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.taxableIncome, defaultLocalCurrency),
  taxRate: parent => parent.taxRate,
  specialTaxableIncome: (parent, _, { adminContext: { defaultLocalCurrency } }) => ({
    amount: formatFinancialAmount(parent.specialTaxableIncome.amount, defaultLocalCurrency),
    records: parent.specialTaxableIncome.records,
  }),
  specialTaxRate: parent => parent.specialTaxRate,
  annualTaxExpense: (parent, _, { adminContext: { defaultLocalCurrency } }) =>
    formatFinancialAmount(parent.annualTaxExpense, defaultLocalCurrency),
};
