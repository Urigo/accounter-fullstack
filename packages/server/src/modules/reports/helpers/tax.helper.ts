import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import { businessTripSummary } from '@modules/business-trips/resolvers/business-trip-summary.resolver.js';
import { BusinessTripProto } from '@modules/business-trips/types.js';
import { CorporateTaxesProvider } from '@modules/corporate-taxes/providers/corporate-taxes.provider.js';
import { DepreciationCategoriesProvider } from '@modules/depreciation/providers/depreciation-categories.provider.js';
import { DepreciationProvider } from '@modules/depreciation/providers/depreciation.provider.js';
import { TimelessDateString } from '@shared/types';
import { CommentaryProto } from '../types.js';
import {
  amountByFinancialEntityIdValidation,
  amountBySortCodeValidation,
  DecoratedLedgerRecord,
  updateRecords,
} from './profit-and-loss.helper.js';

export async function calculateTaxAmounts(
  context: GraphQLModules.Context,
  year: number,
  decoratedLedgerRecords: DecoratedLedgerRecord[],
  yearlyResearchAndDevelopmentExpensesAmount: number,
  researchAndDevelopmentExpensesForTax: number,
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

  let finesAmount = 0;
  const finesRecords = new Map<
    number,
    {
      amount: number;
      records: Map<string, number>;
    }
  >();
  let untaxableGiftsAmount = 0;
  const untaxableGiftsRecords = new Map<
    number,
    {
      amount: number;
      records: Map<string, number>;
    }
  >();
  decoratedLedgerRecords.map(record => {
    if (record.credit_entity1 === untaxableGiftsTaxCategoryId) {
      const amount = -Number(record.credit_local_amount1);
      updateRecords(
        untaxableGiftsRecords,
        amount,
        record.credit_entity_sort_code1!,
        record.credit_entity1,
      );
      untaxableGiftsAmount += amount;
    }
    if (record.credit_entity2 === untaxableGiftsTaxCategoryId) {
      const amount = -Number(record.credit_local_amount2);
      updateRecords(
        untaxableGiftsRecords,
        amount,
        record.credit_entity_sort_code2!,
        record.credit_entity2,
      );
      untaxableGiftsAmount += amount;
    }
    if (record.debit_entity1 === untaxableGiftsTaxCategoryId) {
      const amount = Number(record.debit_local_amount1);
      updateRecords(
        untaxableGiftsRecords,
        amount,
        record.debit_entity_sort_code1!,
        record.debit_entity1,
      );
      untaxableGiftsAmount += amount;
    }
    if (record.debit_entity2 === untaxableGiftsTaxCategoryId) {
      const amount = Number(record.debit_local_amount2);
      updateRecords(
        untaxableGiftsRecords,
        amount,
        record.debit_entity_sort_code2!,
        record.debit_entity2,
      );
      untaxableGiftsAmount += amount;
    }

    if (record.credit_entity1 === fineTaxCategoryId) {
      const amount = -Number(record.credit_local_amount1);
      updateRecords(finesRecords, amount, record.credit_entity_sort_code1!, record.credit_entity1);
      finesAmount += amount;
    }
    if (record.credit_entity2 === fineTaxCategoryId) {
      const amount = -Number(record.credit_local_amount2);
      updateRecords(finesRecords, amount, record.credit_entity_sort_code2!, record.credit_entity2);
      finesAmount += amount;
    }
    if (record.debit_entity1 === fineTaxCategoryId) {
      const amount = Number(record.debit_local_amount1);
      updateRecords(finesRecords, amount, record.debit_entity_sort_code1!, record.debit_entity1);
      finesAmount += amount;
    }
    if (record.debit_entity2 === fineTaxCategoryId) {
      const amount = Number(record.debit_local_amount2);
      updateRecords(finesRecords, amount, record.debit_entity_sort_code2!, record.debit_entity2);
      finesAmount += amount;
    }
  });

  const untaxableGifts: CommentaryProto = {
    amount: untaxableGiftsAmount,
    records: Array.from(untaxableGiftsRecords.entries()).map(([sortCode, data]) => ({
      sortCode,
      amount: data.amount,
      records: Array.from(data.records.entries()).map(([financialEntityId, amount]) => ({
        financialEntityId,
        amount,
      })),
    })),
  };

  const fines: CommentaryProto = {
    amount: finesAmount,
    records: Array.from(finesRecords.entries()).map(([sortCode, data]) => ({
      sortCode,
      amount: data.amount,
      records: Array.from(data.records.entries()).map(([financialEntityId, amount]) => ({
        financialEntityId,
        amount,
      })),
    })),
  };

  let businessTripsExcessExpensesAmount = 0;
  businessTrips.map(summary => {
    const amount = summary.rows.find(row => row.type === 'TOTAL')?.excessExpenditure?.raw ?? 0;
    businessTripsExcessExpensesAmount += amount;
  });
  const salaryExcessExpensesAmount = amountByFinancialEntityIdValidation(
    decoratedLedgerRecords,
    financialEntityId => financialEntityId === salaryExcessExpensesTaxCategoryId,
    true,
  );
  const reserves = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => sortCode === 931,
    true,
  );

  const taxableIncomeAmount =
    profitBeforeTaxAmount +
    yearlyResearchAndDevelopmentExpensesAmount +
    fines.amount +
    untaxableGifts.amount +
    businessTripsExcessExpensesAmount +
    salaryExcessExpensesAmount +
    reserves.amount +
    researchAndDevelopmentExpensesForTax;

  const taxRate = Number(taxRateVariables.tax_rate) / 100;
  const annualTaxExpenseAmount = taxableIncomeAmount * taxRate;

  return {
    researchAndDevelopmentExpensesForTax,
    fines,
    untaxableGifts,
    businessTripsExcessExpensesAmount,
    salaryExcessExpensesAmount,
    reserves,
    taxableIncomeAmount,
    taxRate,
    annualTaxExpenseAmount,
  };
}

export async function calculateDepreciationAmount(injector: Injector, year: number) {
  const yearBeginning = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const depreciationRecords = await injector
    .get(DepreciationProvider)
    .getDepreciationRecordsByDates({
      fromDate: yearBeginning,
      toDate: yearEnd,
    });

  let rndDepreciationYearlyAmount = 0;
  let gnmDepreciationYearlyAmount = 0;
  let marketingDepreciationYearlyAmount = 0;

  await Promise.all(
    depreciationRecords.map(async record => {
      if (!record.expiration_date) {
        console.error('No expiration date for depreciation record', record);
        return;
      }

      const depreciationCategory = await injector
        .get(DepreciationCategoriesProvider)
        .getDepreciationCategoriesByIdLoader.load(record.category);
      if (!depreciationCategory) {
        console.error('No depreciation category for depreciation record', record);
        return;
      }

      const yearDays = differenceInDays(yearEnd, yearBeginning) + 1;
      let daysOfRelevance = yearDays;
      if (record.activation_date.getTime() > yearBeginning.getTime()) {
        daysOfRelevance -= differenceInDays(record.activation_date, yearBeginning);
      }
      if (record.expiration_date.getTime() < yearEnd.getTime()) {
        daysOfRelevance -= differenceInDays(yearEnd, record.expiration_date);
      }
      if (daysOfRelevance <= 0) {
        console.error('No days of relevance for depreciation record', record);
        return;
      }

      const part = daysOfRelevance / yearDays;
      const yearlyPercent = Number(depreciationCategory.percentage) / 100;
      switch (record.type) {
        case 'RESEARCH_AND_DEVELOPMENT':
          rndDepreciationYearlyAmount += Number(record.amount) * part * yearlyPercent;
          break;
        case 'GENERAL_AND_MANAGEMENT':
          gnmDepreciationYearlyAmount += Number(record.amount) * part * yearlyPercent;
          break;
        case 'MARKETING':
          marketingDepreciationYearlyAmount += Number(record.amount) * part * yearlyPercent;
          break;
        default:
          throw new GraphQLError(`Unknown depreciation record type ${record.type}`);
      }
    }),
  );

  const totalDepreciationYearlyAmount =
    rndDepreciationYearlyAmount + gnmDepreciationYearlyAmount + marketingDepreciationYearlyAmount;

  return {
    rndDepreciationYearlyAmount,
    gnmDepreciationYearlyAmount,
    marketingDepreciationYearlyAmount,
    totalDepreciationYearlyAmount,
  };
}
