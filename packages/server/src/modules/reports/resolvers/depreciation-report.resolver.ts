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
import {
  calculateAssetYear,
  type AssetDepreciationInput,
  type AssetYearResult,
} from '../../depreciation/helpers/asset-depreciation.helper.js';
import {
  loadAssetInput,
  loadDisposalInputs,
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
  reportYearRefundedCost: number;
  totalDepreciableCosts: number;
  statutoryDepreciationRate: number;
  claimedDepreciationRate: number;
  reportYearClaimedDepreciation: number;
  pastYearsAccumulatedDepreciation: number;
  reportYearDisposedDepreciation: number;
  reportYearDepreciationCorrection: number;
  totalDepreciation: number;
  netValue: number;
  reportYearDisposalProceeds: number;
  reportYearDisposalGainLoss: number;
  disposalDate?: TimelessDateString;
  /** The year's sales and write-offs */
  disposals: IGetDepreciationDisposalsByIdsResult[];
  /** The year's cost refunds */
  costRefunds: IGetDepreciationDisposalsByIdsResult[];
};

const SUMMARY_KEYS = [
  'originalCost',
  'reportYearDelta',
  'reportYearDisposedCost',
  'reportYearRefundedCost',
  'totalDepreciableCosts',
  'reportYearClaimedDepreciation',
  'pastYearsAccumulatedDepreciation',
  'reportYearDisposedDepreciation',
  'reportYearDepreciationCorrection',
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

/**
 * True when an asset with a cost was closed by its events (fully disposed of or refunded) before
 * the year started, so it had nothing on the books during the year and gets no row. An asset
 * without a cost (a missing amount) is not closed: its zero row is the cue to fill it in.
 */
function isClosedBeforeYear(
  asset: AssetDepreciationInput,
  events: readonly Pick<IGetDepreciationDisposalsByIdsResult, 'disposal_date'>[],
  yearStart: TimelessDateString,
  yearResult: AssetYearResult,
) {
  return (
    asset.cost > 0 &&
    events.some(event => event.disposal_date < yearStart) &&
    yearResult.openingCost === 0 &&
    yearResult.additions === 0 &&
    yearResult.disposals.length === 0 &&
    yearResult.costRefunds.length === 0 &&
    yearResult.openingAccumulatedDepreciation === 0 &&
    yearResult.closingAccumulatedDepreciation === 0
  );
}

/** A category with a 0% rate holds assets that are not depreciated, such as trademarks */
function isDepreciated(category: Pick<IGetAllDepreciationCategoriesResult, 'percentage'>) {
  return Number(category.percentage) > 0;
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

      // Assets in categories that are not depreciated (0%) stay off the report: no rows, no totals
      const notDepreciatedCategoryIds = new Set(
        depreciationCategories
          .filter(category => !isDepreciated(category))
          .map(category => category.id),
      );
      const categoryMap = new Map<
        string,
        {
          category: IGetAllDepreciationCategoriesResult;
          assets: AssetRecord[];
          summary: Summary;
        }
      >(
        depreciationCategories
          .filter(category => isDepreciated(category))
          .map(category => [category.id, { category, assets: [], summary: emptySummary() }]),
      );

      await Promise.all(
        depreciationRecords.map(async record => {
          if (notDepreciatedCategoryIds.has(record.category)) {
            return;
          }
          const depreciationCategory = categoryMap.get(record.category);
          if (!depreciationCategory) {
            console.error('No depreciation category for depreciation record', record);
            return;
          }

          const [charge, { transactionsMinDebitDate }, disposals, asset] = await Promise.all([
            injector.get(ChargesProvider).getChargeByIdLoader.load(record.charge_id),
            getChargeTransactionsMeta(record.charge_id, injector),
            injector
              .get(DepreciationDisposalsProvider)
              .getDisposalsByDepreciationIdLoader.load(record.id),
            // the cost basis in the local currency: a foreign-currency asset is converted
            loadAssetInput(injector, record, depreciationCategory.category),
          ]);
          if (!charge || charge instanceof Error) {
            console.error('No charge for depreciation record', record);
            return;
          }

          const yearResult = calculateAssetYear(
            asset,
            await loadDisposalInputs(injector, record, disposals),
            year,
          );
          if (isClosedBeforeYear(asset, disposals, startOfTimelessYear(year), yearResult)) {
            return;
          }
          const yearDisposalIds = new Set(yearResult.disposals.map(disposal => disposal.id));
          const yearRefundIds = new Set(yearResult.costRefunds.map(refund => refund.id));
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
            reportYearRefundedCost: yearResult.refundedCost,
            totalDepreciableCosts: yearResult.closingCost,
            statutoryDepreciationRate: Number(depreciationCategory.category.percentage),
            claimedDepreciationRate: yearResult.yearlyDepreciationRate,
            reportYearClaimedDepreciation: yearResult.yearDepreciation,
            pastYearsAccumulatedDepreciation: yearResult.openingAccumulatedDepreciation,
            reportYearDisposedDepreciation: yearResult.disposedAccumulatedDepreciation,
            reportYearDepreciationCorrection: yearResult.depreciationCorrection,
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
            costRefunds: disposals.filter(disposal => yearRefundIds.has(disposal.id)),
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
    reportYearRefundedCost: record => nullableRound(record.reportYearRefundedCost),
    reportYearDisposedDepreciation: record => nullableRound(record.reportYearDisposedDepreciation),
    reportYearDepreciationCorrection: record =>
      nullableRound(record.reportYearDepreciationCorrection),
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
    reportYearRefundedCost: record => nullableRound(record.reportYearRefundedCost),
    reportYearDisposedDepreciation: record => nullableRound(record.reportYearDisposedDepreciation),
    reportYearDepreciationCorrection: record =>
      nullableRound(record.reportYearDepreciationCorrection),
    reportYearDisposalProceeds: record => nullableRound(record.reportYearDisposalProceeds),
    reportYearDisposalGainLoss: record => nullableRound(record.reportYearDisposalGainLoss),
    totalDepreciableCosts: record => Math.round(record.totalDepreciableCosts),
    reportYearClaimedDepreciation: record => Math.round(record.reportYearClaimedDepreciation),
    pastYearsAccumulatedDepreciation: record => Math.round(record.pastYearsAccumulatedDepreciation),
    totalDepreciation: record => Math.round(record.totalDepreciation),
    netValue: record => Math.round(record.netValue),
  },
};
