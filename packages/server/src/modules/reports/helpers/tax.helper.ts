import { GraphQLError } from 'graphql';
import { TimelessDateString } from '../../../shared/types/index.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { businessTripSummary } from '../../business-trips/resolvers/business-trip-summary.resolver.js';
import { BusinessTripProto } from '../../business-trips/types.js';
import { CorporateTaxesProvider } from '../../corporate-taxes/providers/corporate-taxes.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import {
  amountByFinancialEntityIdAndSortCodeValidations,
  FilteringOptions,
  recordsByFinancialEntityIdAndSortCodeValidations,
} from './misc.helper.js';
import { DecoratedLedgerRecord, getProfitLossReportAmounts } from './profit-and-loss.helper.js';

export async function calculateTaxAmounts(
  context: GraphQLModules.Context,
  year: number,
  decoratedLedgerRecords: DecoratedLedgerRecord[],
  yearlyResearchAndDevelopmentExpensesAmount: number,
  threeYearsResearchAndDevelopmentExpensesForTax: number,
  profitBeforeTaxAmount: number,
) {
  const {
    injector,
    adminContext: {
      general: {
        taxCategories: {
          fineTaxCategoryId,
          untaxableGiftsTaxCategoryId,
          salaryExcessExpensesTaxCategoryId,
        },
      },
    },
  } = context;
  const taxRateVariablesPromise = injector
    .get(CorporateTaxesProvider)
    .getCorporateTaxesByDateLoader.load(`${year}-01-01` as TimelessDateString);
  const businessTripsPromise = injector
    .get(BusinessTripsProvider)
    .getBusinessTripsByDates({
      fromDate: `${year}-01-01` as TimelessDateString,
      toDate: `${year}-12-31` as TimelessDateString,
    })
    .then(
      async businessTrips =>
        await Promise.all(
          businessTrips.map(trip => businessTripSummary(context, trip as BusinessTripProto)),
        ),
    );
  const [taxRateVariables, businessTrips] = await Promise.all([
    taxRateVariablesPromise,
    businessTripsPromise,
  ]);

  if (!taxRateVariables) {
    throw new GraphQLError('No tax rate for year');
  }

  const excludedTaxCategories = await injector
    .get(TaxCategoriesProvider)
    .getAllTaxCategories()
    .then(res => res.filter(tc => !!tc.tax_excluded).map(tc => tc.id));

  const untaxableGiftsFilter: FilteringOptions = {
    rule: taxCategoryId => taxCategoryId === untaxableGiftsTaxCategoryId,
    negate: true,
  };
  const finesFilter: FilteringOptions = {
    rule: taxCategoryId => taxCategoryId === fineTaxCategoryId,
    negate: true,
  };
  const reservesFilter: FilteringOptions = {
    rule: (financialEntityId, sortCode) =>
      sortCode === 931 && !excludedTaxCategories.includes(financialEntityId),
    negate: true,
  };
  const nontaxableLinkageFilter: FilteringOptions = {
    rule: (financialEntityId, sortCode) =>
      sortCode === 990 && excludedTaxCategories.includes(financialEntityId),
    negate: true,
  };
  // Special tax rate for special taxable income
  const specialTaxableIncomeFilter: FilteringOptions = {
    rule: (_, sortCode) => sortCode === 991,
    negate: true,
  };
  const [untaxableGifts, fines, reserves, nontaxableLinkage, specialTaxableIncome] =
    recordsByFinancialEntityIdAndSortCodeValidations(decoratedLedgerRecords, [
      untaxableGiftsFilter,
      finesFilter,
      reservesFilter,
      nontaxableLinkageFilter,
      specialTaxableIncomeFilter,
    ]);

  let businessTripsExcessExpensesAmount = 0;
  businessTrips.map(summary => {
    const amount = summary.rows.find(row => row.type === 'TOTAL')?.excessExpenditure?.raw ?? 0;
    businessTripsExcessExpensesAmount += amount;
  });

  const businessTripsExcludedFilter: FilteringOptions = {
    rule: (financialEntityId: string, sortCode: number) => {
      return sortCode === 945 && excludedTaxCategories.includes(financialEntityId);
    },
    negate: true,
  };
  const salaryExcessExpensesFilter: FilteringOptions = {
    rule: financialEntityId => financialEntityId === salaryExcessExpensesTaxCategoryId,
    negate: true,
  };
  const yearlyRndExcludedRndFilter: FilteringOptions = {
    rule: (financialEntityId: string, sortCode: number) => {
      return sortCode === 922 && excludedTaxCategories.includes(financialEntityId);
    },
    negate: true,
  };
  const [businessTripsExcludedAmount, salaryExcessExpensesAmount, yearlyRndExcludedRnd] =
    amountByFinancialEntityIdAndSortCodeValidations(decoratedLedgerRecords, [
      businessTripsExcludedFilter,
      salaryExcessExpensesFilter,
      yearlyRndExcludedRndFilter,
    ]);

  businessTripsExcessExpensesAmount += businessTripsExcludedAmount;

  const researchAndDevelopmentExpensesForTax =
    threeYearsResearchAndDevelopmentExpensesForTax + yearlyRndExcludedRnd;

  const taxableIncomeAmount =
    profitBeforeTaxAmount +
    yearlyResearchAndDevelopmentExpensesAmount +
    fines.amount +
    untaxableGifts.amount +
    businessTripsExcessExpensesAmount +
    salaryExcessExpensesAmount +
    reserves.amount +
    nontaxableLinkage.amount +
    researchAndDevelopmentExpensesForTax;

  const taxRate = Number(taxRateVariables.tax_rate) / 100;

  const specialTaxRate = Number(taxRateVariables.original_tax_rate) / 100;

  const annualTaxExpenseAmount =
    taxableIncomeAmount * taxRate + specialTaxableIncome.amount * specialTaxRate;

  return {
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
  };
}

export function calculateCumulativeRnDExpenses(
  year: number,
  decoratedLedgerByYear: Map<number, DecoratedLedgerRecord[]>,
  profitLossByYear: Map<number, ReturnType<typeof getProfitLossReportAmounts>> = new Map(),
): number {
  let cumulativeResearchAndDevelopmentExpensesAmount = 0;
  for (const rndYear of [year - 2, year - 1, year]) {
    let profitLossHelperReportAmounts = profitLossByYear.get(rndYear);
    if (!profitLossHelperReportAmounts) {
      const rndDecoratedLedgerRecords = decoratedLedgerByYear.get(rndYear) ?? [];
      profitLossHelperReportAmounts = getProfitLossReportAmounts(rndDecoratedLedgerRecords);
      profitLossByYear.set(rndYear, profitLossHelperReportAmounts);
    }

    cumulativeResearchAndDevelopmentExpensesAmount +=
      profitLossHelperReportAmounts.researchAndDevelopmentExpenses.amount;
  }

  return cumulativeResearchAndDevelopmentExpensesAmount;
}
