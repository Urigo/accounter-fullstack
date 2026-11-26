import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { businessTripSummary } from '../../business-trips/resolvers/business-trip-summary.resolver.js';
import { BusinessTripProto } from '../../business-trips/types.js';
import { CorporateTaxesProvider } from '../../corporate-taxes/providers/corporate-taxes.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import type { CommentaryProto } from '../types.js';
import {
  amountByFinancialEntityIdAndSortCodeValidations,
  FilteringOptions,
  recordsByFinancialEntityIdAndSortCodeValidations,
} from './misc.helper.js';
import { DecoratedLedgerRecord, getProfitLossReportAmounts } from './profit-and-loss.helper.js';

const RESERVES_SORT_CODE = 931;

/**
 * First tax year that keeps reserves (931) out of R&D for tax (#5088). Earlier years were filed with
 * 931 inside R&D, so they keep that treatment, including their share of the section 20A spread in
 * the following years, to match what was filed.
 */
const RESERVES_RND_CUTOVER_YEAR = 2025;

type ProfitLossReportAmounts = ReturnType<typeof getProfitLossReportAmounts>;

/**
 * R&D of `year` for the tax computation. Reserves (931) are part of R&D in the P&L, but from
 * {@link RESERVES_RND_CUTOVER_YEAR} on, tax adjusts them once, as reserves (6111 line 150), and
 * never through the section 20A spread.
 */
export function researchAndDevelopmentForTax(
  researchAndDevelopment: CommentaryProto,
  year: number,
): CommentaryProto {
  if (year < RESERVES_RND_CUTOVER_YEAR) {
    return researchAndDevelopment;
  }
  const records = researchAndDevelopment.records.filter(
    record => record.sortCode !== RESERVES_SORT_CODE,
  );
  return {
    amount: records.reduce((sum, record) => sum + record.amount, 0),
    records,
  };
}

/**
 * The tax computation of `year`, shared by the tax report, the tax-expense charge and 6111 so they
 * always agree. `decoratedLedgerByYear` must hold `year` and the two years before it (section 20A).
 */
export async function calculateYearTax(
  injector: Injector,
  year: number,
  decoratedLedgerByYear: Map<number, DecoratedLedgerRecord[]>,
  profitLossByYear: Map<number, ProfitLossReportAmounts> = new Map(),
) {
  const decoratedLedgerRecords = decoratedLedgerByYear.get(year) ?? [];
  let profitAndLoss = profitLossByYear.get(year);
  if (!profitAndLoss) {
    profitAndLoss = getProfitLossReportAmounts(decoratedLedgerRecords);
    profitLossByYear.set(year, profitAndLoss);
  }

  const researchAndDevelopment = researchAndDevelopmentForTax(
    profitAndLoss.researchAndDevelopmentExpenses,
    year,
  );
  const researchAndDevelopmentAddBack = researchAndDevelopment.amount * -1;
  const taxableCumulativeResearchAndDevelopment =
    calculateCumulativeRnDExpenses(year, decoratedLedgerByYear, profitLossByYear) / 3;

  const taxAmounts = await calculateTaxAmounts(
    injector,
    year,
    decoratedLedgerRecords,
    researchAndDevelopmentAddBack,
    taxableCumulativeResearchAndDevelopment,
    profitAndLoss.profitBeforeTax.amount,
  );

  return {
    profitAndLoss,
    /** R&D for tax, as booked (negative); the tax report lists its records */
    researchAndDevelopment,
    researchAndDevelopmentAddBack,
    ...taxAmounts,
  };
}

export async function calculateTaxAmounts(
  injector: Injector,
  year: number,
  decoratedLedgerRecords: DecoratedLedgerRecord[],
  yearlyResearchAndDevelopmentExpensesAmount: number,
  threeYearsResearchAndDevelopmentExpensesForTax: number,
  profitBeforeTaxAmount: number,
) {
  const {
    general: {
      taxCategories: {
        fineTaxCategoryId,
        untaxableGiftsTaxCategoryId,
        salaryExcessExpensesTaxCategoryId,
      },
    },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

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
          businessTrips.map(trip => businessTripSummary(injector, trip as BusinessTripProto)),
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
      sortCode === RESERVES_SORT_CODE && !excludedTaxCategories.includes(financialEntityId),
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
    negate: false,
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
    researchAndDevelopmentExpensesForTax -
    specialTaxableIncome.amount;

  const taxRate = Number(taxRateVariables.tax_rate) / 100;

  const specialTaxRate = Number(taxRateVariables.original_tax_rate) / 100;

  const { annualTaxExpenseAmount, currentTaxExpense, taxableLoss, mixedRateLoss } =
    computeCurrentTax({
      taxableIncomeAmount,
      taxRate,
      specialTaxableIncomeAmount: specialTaxableIncome.amount,
      specialTaxRate,
    });

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
    currentTaxExpense,
    taxableLoss,
    mixedRateLoss,
  };
}

/**
 * Current tax for the year, from the regular-rate and preferred-rate (sort code 991) taxable incomes.
 *
 * - `annualTaxExpenseAmount`: the raw formula; negative in a loss year.
 * - `currentTaxExpense`: what gets booked — current tax is never negative (a loss is carried
 *   forward instead, which is out of scope here).
 * - `taxableLoss`: the year's total taxable loss as a positive amount, or 0.
 * - `mixedRateLoss`: one income is a loss while the other is a profit. The formula nets them at
 *   different rates; the loss-offset order must be confirmed with the accountant, so this is flagged.
 */
export function computeCurrentTax({
  taxableIncomeAmount,
  taxRate,
  specialTaxableIncomeAmount,
  specialTaxRate,
}: {
  taxableIncomeAmount: number;
  taxRate: number;
  specialTaxableIncomeAmount: number;
  specialTaxRate: number;
}) {
  const annualTaxExpenseAmount =
    taxableIncomeAmount * taxRate + specialTaxableIncomeAmount * specialTaxRate;

  return {
    annualTaxExpenseAmount,
    currentTaxExpense: Math.max(0, annualTaxExpenseAmount),
    taxableLoss: Math.max(0, -(taxableIncomeAmount + specialTaxableIncomeAmount)),
    mixedRateLoss:
      (taxableIncomeAmount < 0 && specialTaxableIncomeAmount > 0) ||
      (taxableIncomeAmount > 0 && specialTaxableIncomeAmount < 0),
  };
}

export function calculateCumulativeRnDExpenses(
  year: number,
  decoratedLedgerByYear: Map<number, DecoratedLedgerRecord[]>,
  profitLossByYear: Map<number, ProfitLossReportAmounts> = new Map(),
): number {
  let cumulativeResearchAndDevelopmentExpensesAmount = 0;
  for (const rndYear of [year - 2, year - 1, year]) {
    let profitLossHelperReportAmounts = profitLossByYear.get(rndYear);
    if (!profitLossHelperReportAmounts) {
      const rndDecoratedLedgerRecords = decoratedLedgerByYear.get(rndYear) ?? [];
      profitLossHelperReportAmounts = getProfitLossReportAmounts(rndDecoratedLedgerRecords);
      profitLossByYear.set(rndYear, profitLossHelperReportAmounts);
    }

    cumulativeResearchAndDevelopmentExpensesAmount += researchAndDevelopmentForTax(
      profitLossHelperReportAmounts.researchAndDevelopmentExpenses,
      rndYear,
    ).amount;
  }

  return cumulativeResearchAndDevelopmentExpensesAmount;
}
