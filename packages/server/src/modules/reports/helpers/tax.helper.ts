import { GraphQLError } from 'graphql';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import { businessTripSummary } from '@modules/business-trips/resolvers/business-trip-summary.resolver.js';
import { BusinessTripProto } from '@modules/business-trips/types.js';
import { CorporateTaxesProvider } from '@modules/corporate-taxes/providers/corporate-taxes.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { TimelessDateString } from '@shared/types';
import { CommentaryProto } from '../types.js';
import {
  amountByFinancialEntityIdAndSortCodeValidation,
  DecoratedLedgerRecord,
  recordsByFinancialEntityIdAndSortCodeValidation,
  updateRecords,
} from './profit-and-loss.helper.js';

function updateAmountAndRecords(
  record: DecoratedLedgerRecord,
  financialEntityId: string,
  sumAmount: number,
  records: Map<
    number,
    {
      amount: number;
      records: Map<string, number>;
    }
  >,
) {
  if (record.credit_entity1 === financialEntityId) {
    const amount = -Number(record.credit_local_amount1);
    updateRecords(records, amount, record.credit_entity_sort_code1!, record.credit_entity1);
    sumAmount += amount;
  }
  if (record.credit_entity2 === financialEntityId) {
    const amount = -Number(record.credit_local_amount2);
    updateRecords(records, amount, record.credit_entity_sort_code2!, record.credit_entity2);
    sumAmount += amount;
  }
  if (record.debit_entity1 === financialEntityId) {
    const amount = Number(record.debit_local_amount1);
    updateRecords(records, amount, record.debit_entity_sort_code1!, record.debit_entity1);
    sumAmount += amount;
  }
  if (record.debit_entity2 === financialEntityId) {
    const amount = Number(record.debit_local_amount2);
    updateRecords(records, amount, record.debit_entity_sort_code2!, record.debit_entity2);
    sumAmount += amount;
  }
  return sumAmount;
}

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
    untaxableGiftsAmount = updateAmountAndRecords(
      record,
      untaxableGiftsTaxCategoryId,
      untaxableGiftsAmount,
      untaxableGiftsRecords,
    );
    finesAmount = updateAmountAndRecords(record, fineTaxCategoryId, finesAmount, finesRecords);
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

  const excludedTaxCategories = await injector
    .get(TaxCategoriesProvider)
    .getAllTaxCategories()
    .then(res => res.filter(tc => !!tc.tax_excluded).map(tc => tc.id));

  const filterBusinessTripsExcludedRecords = (financialEntityId: string, sortCode: number) => {
    return sortCode === 945 && excludedTaxCategories.includes(financialEntityId);
  };
  const businessTripsExcludedAmount = amountByFinancialEntityIdAndSortCodeValidation(
    decoratedLedgerRecords,
    filterBusinessTripsExcludedRecords,
    true,
  );
  businessTripsExcessExpensesAmount -= businessTripsExcludedAmount;

  const salaryExcessExpensesAmount = amountByFinancialEntityIdAndSortCodeValidation(
    decoratedLedgerRecords,
    financialEntityId => financialEntityId === salaryExcessExpensesTaxCategoryId,
    true,
  );
  const reserves = recordsByFinancialEntityIdAndSortCodeValidation(
    decoratedLedgerRecords,
    (financialEntityId, sortCode) =>
      sortCode === 931 && !excludedTaxCategories.includes(financialEntityId),
    true,
  );
  const nontaxableLinkage = recordsByFinancialEntityIdAndSortCodeValidation(
    decoratedLedgerRecords,
    (financialEntityId, sortCode) =>
      sortCode === 990 && excludedTaxCategories.includes(financialEntityId),
    true,
  );

  const filterYearlyRndExcludedRecords = (financialEntityId: string, sortCode: number) => {
    return sortCode === 922 && excludedTaxCategories.includes(financialEntityId);
  };
  const yearlyRndExcludedRnd = amountByFinancialEntityIdAndSortCodeValidation(
    decoratedLedgerRecords,
    filterYearlyRndExcludedRecords,
    true,
  );
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

  // Special tax rate for special taxable income
  const specialTaxableIncome = recordsByFinancialEntityIdAndSortCodeValidation(
    decoratedLedgerRecords,
    (_, sortCode) => sortCode === 991,
    true,
  );
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
