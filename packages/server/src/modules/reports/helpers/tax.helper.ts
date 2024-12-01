import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import { businessTripSummary } from '@modules/business-trips/resolvers/business-trip-summary.resolver.js';
import { BusinessTripProto } from '@modules/business-trips/types.js';
import { CorporateTaxesProvider } from '@modules/corporate-taxes/providers/corporate-taxes.provider.js';
import { DepreciationCategoriesProvider } from '@modules/depreciation/providers/depreciation-categories.provider.js';
import { DepreciationProvider } from '@modules/depreciation/providers/depreciation.provider.js';
import { FINE_TAX_CATEGORY_ID, UNTAXABLE_GIFTS_TAX_CATEGORY_ID } from '@shared/constants';
import { TimelessDateString } from '@shared/types';
import { amountBySortCodeValidation, DecoratedLedgerRecord } from './profit-and-loss.helper.js';

export async function calculateTaxAmounts(
  injector: Injector,
  year: number,
  decoratedLedgerRecords: DecoratedLedgerRecord[],
  researchAndDevelopmentExpensesAmount: number,
  profitBeforeTaxAmount: number,
) {
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

  const researchAndDevelopmentExpensesForTax = researchAndDevelopmentExpensesAmount / 3;

  const fines: { amount: number; records: DecoratedLedgerRecord[]; entityIds: string[] } = {
    amount: 0,
    records: [],
    entityIds: [],
  };
  const untaxableGifts: {
    amount: number;
    records: DecoratedLedgerRecord[];
    entityIds: string[];
  } = {
    amount: 0,
    records: [],
    entityIds: [],
  };
  decoratedLedgerRecords.map(record => {
    let shouldIncludeRecord = false;
    if (record.credit_entity1 === UNTAXABLE_GIFTS_TAX_CATEGORY_ID) {
      shouldIncludeRecord = true;
      untaxableGifts.entityIds.push(record.credit_entity1);
      untaxableGifts.amount += Number(record.credit_local_amount1);
    }
    if (record.credit_entity2 === UNTAXABLE_GIFTS_TAX_CATEGORY_ID) {
      shouldIncludeRecord = true;
      untaxableGifts.entityIds.push(record.credit_entity2);
      untaxableGifts.amount += Number(record.credit_local_amount2);
    }
    if (record.debit_entity1 === UNTAXABLE_GIFTS_TAX_CATEGORY_ID) {
      shouldIncludeRecord = true;
      untaxableGifts.entityIds.push(record.debit_entity1);
      untaxableGifts.amount -= Number(record.debit_local_amount1);
    }
    if (record.debit_entity2 === UNTAXABLE_GIFTS_TAX_CATEGORY_ID) {
      shouldIncludeRecord = true;
      untaxableGifts.entityIds.push(record.debit_entity2);
      untaxableGifts.amount -= Number(record.debit_local_amount2);
    }
    if (shouldIncludeRecord) {
      untaxableGifts.records.push(record);
    }

    shouldIncludeRecord = false;
    if (record.credit_entity1 === FINE_TAX_CATEGORY_ID) {
      shouldIncludeRecord = true;
      fines.entityIds.push(record.credit_entity1);
      fines.amount += Number(record.credit_local_amount1);
    }
    if (record.credit_entity2 === FINE_TAX_CATEGORY_ID) {
      shouldIncludeRecord = true;
      fines.entityIds.push(record.credit_entity2);
      fines.amount += Number(record.credit_local_amount2);
    }
    if (record.debit_entity1 === FINE_TAX_CATEGORY_ID) {
      shouldIncludeRecord = true;
      fines.entityIds.push(record.debit_entity1);
      fines.amount -= Number(record.debit_local_amount1);
    }
    if (record.debit_entity2 === FINE_TAX_CATEGORY_ID) {
      shouldIncludeRecord = true;
      fines.entityIds.push(record.debit_entity2);
      fines.amount -= Number(record.debit_local_amount2);
    }
    if (shouldIncludeRecord) {
      fines.records.push(record);
    }
  });

  let businessTripsExcessExpensesAmount = 0;
  businessTrips.map(summary => {
    const amount = summary.rows.find(row => row.type === 'TOTAL')?.excessExpenditure?.raw ?? 0;
    businessTripsExcessExpensesAmount += amount;
  });
  const salaryExcessExpensesAmount = 0; // TODO: get amounts directly from accountant
  const reserves = amountBySortCodeValidation(decoratedLedgerRecords, sortCode => sortCode === 931);

  const taxableIncomeAmount =
    profitBeforeTaxAmount -
    researchAndDevelopmentExpensesAmount -
    fines.amount -
    untaxableGifts.amount +
    businessTripsExcessExpensesAmount -
    salaryExcessExpensesAmount -
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

  let depreciationYearlyAmount = 0;

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
      depreciationYearlyAmount += Number(record.amount) * part * yearlyPercent;
    }),
  );

  return { depreciationYearlyAmount };
}
