import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { endOfTimelessYear, startOfTimelessYear } from '../../../shared/helpers/index.js';
import { calculateDepreciation } from '../../depreciation/helpers/asset-depreciation.helper.js';
import { DepreciationCategoriesProvider } from '../../depreciation/providers/depreciation-categories.provider.js';
import { DepreciationProvider } from '../../depreciation/providers/depreciation.provider.js';

export { calculateDepreciation };

export async function calculateDepreciationAmount(injector: Injector, year: number) {
  const depreciationRecords = await injector
    .get(DepreciationProvider)
    .getDepreciationRecordsByDates({
      fromDate: startOfTimelessYear(year),
      toDate: endOfTimelessYear(year),
    });

  let rndDepreciationYearlyAmount = 0;
  let gnmDepreciationYearlyAmount = 0;
  let marketingDepreciationYearlyAmount = 0;

  await Promise.all(
    depreciationRecords.map(async record => {
      const depreciationCategory = await injector
        .get(DepreciationCategoriesProvider)
        .getDepreciationCategoriesByIdLoader.load(record.category);
      if (!depreciationCategory) {
        console.error('No depreciation category for depreciation record', record);
        return;
      }

      // the end of depreciation follows from the category rate and the activation date
      const { yearlyDepreciationAmount } = calculateDepreciation(
        Number(depreciationCategory.percentage),
        Number(record.amount),
        record.activation_date,
        year,
      );

      switch (record.type) {
        case 'RESEARCH_AND_DEVELOPMENT':
          rndDepreciationYearlyAmount += yearlyDepreciationAmount;
          break;
        case 'GENERAL_AND_MANAGEMENT':
          gnmDepreciationYearlyAmount += yearlyDepreciationAmount;
          break;
        case 'MARKETING':
          marketingDepreciationYearlyAmount += yearlyDepreciationAmount;
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
