import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { CorporateTaxesProvider } from '@modules/corporate-taxes/providers/corporate-taxes.provider.js';
import { DepreciationCategoriesProvider } from '@modules/depreciation/providers/depreciation-categories.provider.js';
import { DepreciationProvider } from '@modules/depreciation/providers/depreciation.provider.js';
import { TimelessDateString } from '@shared/types';

export async function calculateTaxAmounts(
  injector: Injector,
  year: number,
  researchAndDevelopmentExpensesAmount: number,
  profitBeforeTaxAmount: number,
) {
  const researchAndDevelopmentExpensesForTax = researchAndDevelopmentExpensesAmount / 3;

  const taxableIncomeAmount =
    profitBeforeTaxAmount -
    researchAndDevelopmentExpensesAmount +
    researchAndDevelopmentExpensesForTax;

  const depreciationAmountPromise = calculateDepreciationAmount(injector, year);
  const taxRatePromise = injector
    .get(CorporateTaxesProvider)
    .getCorporateTaxesByDateLoader.load(`${year}-01-01` as TimelessDateString);
  const [{ depreciationYearlyAmount }, taxRateVariables] = await Promise.all([
    depreciationAmountPromise,
    taxRatePromise,
  ]);

  if (!taxRateVariables) {
    throw new GraphQLError('No tax rate for year');
  }
  const taxRate = Number(taxRateVariables.tax_rate) / 100;

  const annualTaxExpenseAmount = taxableIncomeAmount * taxRate;

  // מיסים
  // 3 סוגי התאמות:
  // מתנות - אף פעם לא מוכר
  // קנסות
  // מחקר ופיתוח: פער זמני, נפרש על פני 3 שנים
  // דוחות נסיעה

  //   untaxable expenses:
  //     gifts over 190 ILS per gift
  //     fines
  //     a portion of the salary expenses of Uri&Dotan - a report from accounting
  //     R&D expenses - spread over 3 years

  return {
    researchAndDevelopmentExpensesForTax,
    taxableIncomeAmount,
    taxRate,
    annualTaxExpenseAmount,
    depreciationForTax: depreciationYearlyAmount,
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
