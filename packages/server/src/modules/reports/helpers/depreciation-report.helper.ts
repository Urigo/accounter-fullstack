import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { endOfTimelessYear, startOfTimelessYear } from '../../../shared/helpers/index.js';
import {
  calculateAssetYear,
  calculateDepreciation,
} from '../../depreciation/helpers/asset-depreciation.helper.js';
import {
  toAssetInput,
  toDisposalInput,
} from '../../depreciation/helpers/depreciation-disposals.helper.js';
import { DepreciationCategoriesProvider } from '../../depreciation/providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from '../../depreciation/providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../../depreciation/providers/depreciation.provider.js';

export { calculateDepreciation };

/** The yearly depreciation of `ownerId`'s assets, split by depreciation type */
export async function calculateDepreciationAmount(
  injector: Injector,
  year: number,
  ownerId: string,
) {
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
      if (record.owner_id !== ownerId) {
        return;
      }
      const depreciationCategory = await injector
        .get(DepreciationCategoriesProvider)
        .getDepreciationCategoriesByIdLoader.load(record.category);
      if (!depreciationCategory) {
        console.error('No depreciation category for depreciation record', record);
        return;
      }

      const disposals = await injector
        .get(DepreciationDisposalsProvider)
        .getDisposalsByDepreciationIdLoader.load(record.id);
      const { yearDepreciation: yearlyDepreciationAmount } = calculateAssetYear(
        toAssetInput(record, depreciationCategory),
        disposals.map(toDisposalInput),
        year,
      );
      // nothing to add: fully depreciated or disposed of, or in a category that is not depreciated (0%)
      if (yearlyDepreciationAmount === 0) {
        return;
      }

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
