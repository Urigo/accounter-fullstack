import { differenceInDays } from 'date-fns';
import { Injector } from 'graphql-modules';
import { DepreciationCategoriesProvider } from '@modules/depreciation/providers/depreciation-categories.provider';
import { DepreciationProvider } from '@modules/depreciation/providers/depreciation.provider';

export async function calculateRecoveryReservesAmount(injector: Injector, year: number) {
  const yearBeginning = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const depreciationRecords = await injector
    .get(DepreciationProvider)
    .getDepreciationRecordsByDates({
      fromDate: yearBeginning,
      toDate: yearEnd,
    });

  let yearlyRecoveryReservesAmount = 0;

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
      yearlyRecoveryReservesAmount += Number(record.amount) * part * yearlyPercent;
    }),
  );

  return { yearlyRecoveryReservesAmount };
}
