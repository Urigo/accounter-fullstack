// import { GraphQLError } from 'graphql';
import { GraphQLError } from 'graphql';
import {
  currentTenantYear,
  endOfTimelessYear,
  startOfTimelessYear,
} from '../../../shared/helpers/index.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { getChargeTransactionsMeta } from '../../charges/helpers/common.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { calculateAssetYear } from '../../depreciation/helpers/asset-depreciation.helper.js';
import {
  toAssetInput,
  toDisposalInput,
} from '../../depreciation/helpers/depreciation-disposals.helper.js';
import { DepreciationCategoriesProvider } from '../../depreciation/providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from '../../depreciation/providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../../depreciation/providers/depreciation.provider.js';
import type {
  IGetAllDepreciationCategoriesResult,
  IGetDepreciationDisposalsByIdsResult,
} from '../../depreciation/types.js';
import type { ReportsModule } from '../types.js';

type AssetRecord = {
  id: string;
  chargeId: string;
  description?: string;
  purchaseDate: TimelessDateString;
  activationDate: TimelessDateString;
  originalCost: number;
  reportYearDelta: number;
  reportYearDisposedCost: number;
  totalDepreciableCosts: number;
  statutoryDepreciationRate: number;
  claimedDepreciationRate: number;
  reportYearClaimedDepreciation: number;
  pastYearsAccumulatedDepreciation: number;
  reportYearDisposedDepreciation: number;
  totalDepreciation: number;
  netValue: number;
  reportYearDisposalProceeds: number;
  reportYearDisposalGainLoss: number;
  disposalDate?: TimelessDateString;
  disposals: IGetDepreciationDisposalsByIdsResult[];
};

const SUMMARY_KEYS = [
  'originalCost',
  'reportYearDelta',
  'reportYearDisposedCost',
  'totalDepreciableCosts',
  'reportYearClaimedDepreciation',
  'pastYearsAccumulatedDepreciation',
  'reportYearDisposedDepreciation',
  'totalDepreciation',
  'netValue',
  'reportYearDisposalProceeds',
  'reportYearDisposalGainLoss',
] as const;

type Summary = Record<(typeof SUMMARY_KEYS)[number], number>;

function emptySummary(): Summary {
  return Object.fromEntries(SUMMARY_KEYS.map(key => [key, 0])) as Summary;
}

function addToSummary(summary: Summary, record: Summary) {
  for (const key of SUMMARY_KEYS) {
    summary[key] += record[key];
  }
}

function nullableRound(value?: number | null) {
  return value ? Math.round(value) : null;
}

export const depreciationReportResolvers: ReportsModule.Resolvers = {
  Query: {
    depreciationReport: async (_, { filters }, { injector }) => {
      if (!filters) {
        throw new GraphQLError('No filters provided');
      }
      const { year, financialEntityId: rawFinancialEntityId } = filters;
      if (!year) {
        throw new GraphQLError('Year filter is required');
      }
      if (typeof year !== 'number' || year < 2000 || year > currentTenantYear() + 5) {
        throw new GraphQLError('Invalid year provided');
      }

      const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      const financialEntityId = rawFinancialEntityId ?? ownerId;
      if (!financialEntityId) {
        throw new GraphQLError('Unable to resolve financial entity ID');
      }

      const depreciationRecordsPromise = injector
        .get(DepreciationProvider)
        .getDepreciationRecordsByDates({
          fromDate: startOfTimelessYear(year),
          toDate: endOfTimelessYear(year),
        });
      const depreciationCategoriesPromise = injector
        .get(DepreciationCategoriesProvider)
        .getAllDepreciationCategories();

      const [depreciationRecords, depreciationCategories] = await Promise.all([
        depreciationRecordsPromise,
        depreciationCategoriesPromise,
      ]);

      const categoryMap = new Map<
        string,
        {
          category: IGetAllDepreciationCategoriesResult;
          assets: AssetRecord[];
          summary: Summary;
        }
      >(
        depreciationCategories.map(category => [
          category.id,
          { category, assets: [], summary: emptySummary() },
        ]),
      );

      await Promise.all(
        depreciationRecords.map(async record => {
          const depreciationCategory = categoryMap.get(record.category);
          if (!depreciationCategory) {
            console.error('No depreciation category for depreciation record', record);
            return;
          }

          const [charge, { transactionsMinDebitDate }, disposals] = await Promise.all([
            injector.get(ChargesProvider).getChargeByIdLoader.load(record.charge_id),
            getChargeTransactionsMeta(record.charge_id, injector),
            injector
              .get(DepreciationDisposalsProvider)
              .getDisposalsByDepreciationIdLoader.load(record.id),
          ]);
          if (!charge || charge instanceof Error) {
            console.error('No charge for depreciation record', record);
            return;
          }

          const yearResult = calculateAssetYear(
            toAssetInput(record, depreciationCategory.category),
            disposals.map(toDisposalInput),
            year,
          );
          const yearDisposalIds = new Set(yearResult.disposals.map(disposal => disposal.id));
          const fullyDisposed = yearResult.closingCost === 0 && yearResult.disposals.length > 0;

          const assetRecord: AssetRecord = {
            id: record.id,
            chargeId: record.charge_id,
            description: charge.user_description ?? undefined,
            purchaseDate: transactionsMinDebitDate ?? record.activation_date,
            activationDate: record.activation_date,
            originalCost: yearResult.openingCost,
            reportYearDelta: yearResult.additions,
            reportYearDisposedCost: yearResult.disposedCost,
            totalDepreciableCosts: yearResult.closingCost,
            statutoryDepreciationRate: Number(depreciationCategory.category.percentage),
            claimedDepreciationRate: yearResult.yearlyDepreciationRate,
            reportYearClaimedDepreciation: yearResult.yearDepreciation,
            pastYearsAccumulatedDepreciation: yearResult.openingAccumulatedDepreciation,
            reportYearDisposedDepreciation: yearResult.disposedAccumulatedDepreciation,
            totalDepreciation: yearResult.closingAccumulatedDepreciation,
            netValue: yearResult.netBookValue,
            reportYearDisposalProceeds: yearResult.disposals.reduce(
              (sum, disposal) => sum + disposal.proceeds,
              0,
            ),
            reportYearDisposalGainLoss: yearResult.disposals.reduce(
              (sum, disposal) => sum + disposal.gainLoss,
              0,
            ),
            disposalDate: fullyDisposed ? yearResult.disposals.at(-1)?.disposalDate : undefined,
            disposals: disposals.filter(disposal => yearDisposalIds.has(disposal.id)),
          };

          depreciationCategory.assets.push(assetRecord);
          addToSummary(depreciationCategory.summary, assetRecord);
        }),
      );

      const summary = emptySummary();

      const categories = Array.from(categoryMap.values()).map(category => {
        addToSummary(summary, category.summary);
        return {
          id: `${financialEntityId}-${category.category.id}-${year}`,
          category: category.category,
          records: category.assets,
          summary: {
            id: `${financialEntityId}-${category.category.id}-${year}`,
            ...category.summary,
          },
        };
      });

      return {
        id: `${financialEntityId}-${year}`,
        categories,
        summary: {
          id: `${financialEntityId}-${year}`,
          ...summary,
        },
        year,
      };
    },
  },
  DepreciationReportSummaryRecord: {
    originalCost: record => (record.originalCost ? Math.round(record.originalCost) : null),
    reportYearDelta: record => (record.reportYearDelta ? Math.round(record.reportYearDelta) : null),
    reportYearDisposedCost: record => nullableRound(record.reportYearDisposedCost),
    reportYearDisposedDepreciation: record => nullableRound(record.reportYearDisposedDepreciation),
    reportYearDisposalProceeds: record => nullableRound(record.reportYearDisposalProceeds),
    reportYearDisposalGainLoss: record => nullableRound(record.reportYearDisposalGainLoss),
    totalDepreciableCosts: record => Math.round(record.totalDepreciableCosts),
    reportYearClaimedDepreciation: record => Math.round(record.reportYearClaimedDepreciation),
    pastYearsAccumulatedDepreciation: record => Math.round(record.pastYearsAccumulatedDepreciation),
    totalDepreciation: record => Math.round(record.totalDepreciation),
    netValue: record => Math.round(record.netValue),
  },
  DepreciationReportRecord: {
    originalCost: record => (record.originalCost ? Math.round(record.originalCost) : null),
    reportYearDelta: record => (record.reportYearDelta ? Math.round(record.reportYearDelta) : null),
    reportYearDisposedCost: record => nullableRound(record.reportYearDisposedCost),
    reportYearDisposedDepreciation: record => nullableRound(record.reportYearDisposedDepreciation),
    reportYearDisposalProceeds: record => nullableRound(record.reportYearDisposalProceeds),
    reportYearDisposalGainLoss: record => nullableRound(record.reportYearDisposalGainLoss),
    totalDepreciableCosts: record => Math.round(record.totalDepreciableCosts),
    reportYearClaimedDepreciation: record => Math.round(record.reportYearClaimedDepreciation),
    pastYearsAccumulatedDepreciation: record => Math.round(record.pastYearsAccumulatedDepreciation),
    totalDepreciation: record => Math.round(record.totalDepreciation),
    netValue: record => Math.round(record.netValue),
  },
};
