import { differenceInDays } from 'date-fns';
import type { Injector } from 'graphql-modules';
import { DeprecationCategoriesProvider } from '@modules/deprecation/providers/deprecation-categories.provider.js';
import { DeprecationProvider } from '@modules/deprecation/providers/deprecation.provider.js';

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

  const taxRate = 0.23;

  const annualTaxExpenseAmount = taxableIncomeAmount * taxRate;

  const { deprecationYearlyAmount } = await calculateDeprecationAmount(injector, year);

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
    deprecationForTax: deprecationYearlyAmount,
  };
}

export async function calculateDeprecationAmount(injector: Injector, year: number) {
  const yearBeginning = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const deprecationRecords = await injector.get(DeprecationProvider).getDeprecationRecordsByDates({
    fromDate: yearBeginning,
    toDate: yearEnd,
  });

  let deprecationYearlyAmount = 0;

  await Promise.all(
    deprecationRecords.map(async record => {
      if (!record.expiration_date) {
        console.error('No expiration date for deprecation record', record);
        return;
      }

      const deprecationCategory = await injector
        .get(DeprecationCategoriesProvider)
        .getDeprecationCategoriesByIdLoader.load(record.category);
      if (!deprecationCategory) {
        console.error('No deprecation category for deprecation record', record);
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
        console.error('No days of relevance for deprecation record', record);
        return;
      }

      const part = daysOfRelevance / yearDays;
      const yearlyPercent = Number(deprecationCategory.percentage) / 100;
      deprecationYearlyAmount += Number(record.amount) * part * yearlyPercent;
    }),
  );

  return { deprecationYearlyAmount };
}
