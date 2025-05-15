// import { GraphQLError } from 'graphql';
import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DepreciationCategoriesProvider } from '@modules/depreciation/providers/depreciation-categories.provider.js';
import { DepreciationProvider } from '@modules/depreciation/providers/depreciation.provider.js';
import { IGetAllDepreciationCategoriesResult } from '@modules/depreciation/types.js';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { calculateDepreciation } from '../helpers/depreciation-report.helper.js';
import type { ReportsModule } from '../types.js';

type AssetRecord = {
  id: string;
  chargeId: string;
  description?: string;
  purchaseDate: TimelessDateString;
  activationDate: TimelessDateString;
  originalCost: number;
  reportYearDelta: number;
  totalDepreciableCosts: number;
  statutoryDepreciationRate: number;
  claimedDepreciationRate: number;
  reportYearClaimedDepreciation: number;
  pastYearsAccumulatedDepreciation: number;
  totalDepreciation: number;
  netValue: number;
};

export const depreciationReportResolvers: ReportsModule.Resolvers = {
  Query: {
    depreciationReport: async (
      _,
      { filters },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      if (!filters) {
        throw new GraphQLError('No filters provided');
      }
      const { year, financialEntityId: rawFinancialEntityId } = filters;
      if (!year) {
        throw new GraphQLError('Year filter is required');
      }
      if (typeof year !== 'number' || year < 2000 || year > new Date().getFullYear() + 5) {
        throw new GraphQLError('Invalid year provided');
      }

      const financialEntityId = rawFinancialEntityId ?? defaultAdminBusinessId;
      if (!financialEntityId) {
        throw new GraphQLError('Unable to resolve financial entity ID');
      }

      const yearBeginning = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);

      const depreciationRecordsPromise = injector
        .get(DepreciationProvider)
        .getDepreciationRecordsByDates({
          fromDate: yearBeginning,
          toDate: yearEnd,
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
          originalCost: number;
          reportYearDelta: number;
          totalDepreciableCosts: number;
          reportYearClaimedDepreciation: number;
          pastYearsAccumulatedDepreciation: number;
          totalDepreciation: number;
          netValue: number;
        }
      >(
        depreciationCategories.map(category => [
          category.id,
          {
            category,
            assets: [],
            originalCost: 0,
            reportYearDelta: 0,
            totalDepreciableCosts: 0,
            reportYearClaimedDepreciation: 0,
            pastYearsAccumulatedDepreciation: 0,
            totalDepreciation: 0,
            netValue: 0,
          },
        ]),
      );

      await Promise.all(
        depreciationRecords.map(async record => {
          const depreciationCategory = categoryMap.get(record.category);
          if (!depreciationCategory) {
            console.error('No depreciation category for depreciation record', record);
            return;
          }

          const charge = await injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(record.charge_id);
          if (!charge || charge instanceof Error) {
            console.error('No charge for depreciation record', record);
            return;
          }

          const { yearlyDepreciationAmount, yearlyDepreciationRate, pastDepreciationAmount } =
            calculateDepreciation(
              Number(depreciationCategory.category.percentage),
              Number(record.amount),
              record.activation_date,
              year,
              record.expiration_date ?? undefined,
            );

          const activationYear = record.activation_date.getFullYear();

          const originalCost = activationYear === year ? 0 : Number(record.amount);
          const reportYearDelta = activationYear === year ? Number(record.amount) : 0;
          const totalDepreciableCosts = originalCost + reportYearDelta;
          const totalDepreciation = yearlyDepreciationAmount + pastDepreciationAmount;

          const assetRecord: AssetRecord = {
            id: record.id,
            chargeId: record.charge_id,
            description: charge.user_description ?? undefined,
            purchaseDate: dateToTimelessDateString(
              charge.transactions_min_debit_date ?? record.activation_date,
            ),
            activationDate: dateToTimelessDateString(record.activation_date),
            originalCost: Math.round(originalCost),
            reportYearDelta: Math.round(reportYearDelta),
            totalDepreciableCosts: Math.round(totalDepreciableCosts),
            statutoryDepreciationRate: Number(depreciationCategory.category.percentage),
            claimedDepreciationRate: yearlyDepreciationRate,
            reportYearClaimedDepreciation: Math.round(yearlyDepreciationAmount),
            pastYearsAccumulatedDepreciation: Math.round(pastDepreciationAmount),
            totalDepreciation: Math.round(totalDepreciation),
            netValue: Math.round(totalDepreciableCosts - totalDepreciation),
          };

          depreciationCategory.assets.push(assetRecord);
          depreciationCategory.originalCost += assetRecord.originalCost;
          depreciationCategory.reportYearDelta += assetRecord.reportYearDelta;
          depreciationCategory.totalDepreciableCosts += assetRecord.totalDepreciableCosts;
          depreciationCategory.reportYearClaimedDepreciation +=
            assetRecord.reportYearClaimedDepreciation;
          depreciationCategory.pastYearsAccumulatedDepreciation +=
            assetRecord.pastYearsAccumulatedDepreciation;
          depreciationCategory.totalDepreciation += assetRecord.totalDepreciation;
          depreciationCategory.netValue += assetRecord.netValue;
        }),
      );

      const summary = {
        originalCost: 0,
        reportYearDelta: 0,
        totalDepreciableCosts: 0,
        reportYearClaimedDepreciation: 0,
        pastYearsAccumulatedDepreciation: 0,
        totalDepreciation: 0,
        netValue: 0,
      };

      const categories = Array.from(categoryMap.values()).map(category => {
        const categorySummary = {
          id: `${financialEntityId}-${category.category.id}-${year}`,
          category: category.category,
          records: category.assets,
          summary: {
            id: `${financialEntityId}-${category.category.id}-${year}`,
            originalCost: Math.round(category.originalCost),
            reportYearDelta: Math.round(category.reportYearDelta),
            totalDepreciableCosts: Math.round(category.totalDepreciableCosts),
            reportYearClaimedDepreciation: Math.round(category.reportYearClaimedDepreciation),
            pastYearsAccumulatedDepreciation: Math.round(category.pastYearsAccumulatedDepreciation),
            totalDepreciation: Math.round(category.totalDepreciation),
            netValue: Math.round(category.netValue),
          },
        };
        summary.originalCost += category.originalCost;
        summary.reportYearDelta += category.reportYearDelta;
        summary.totalDepreciableCosts += category.totalDepreciableCosts;
        summary.reportYearClaimedDepreciation += category.reportYearClaimedDepreciation;
        summary.pastYearsAccumulatedDepreciation += category.pastYearsAccumulatedDepreciation;
        summary.totalDepreciation += category.totalDepreciation;
        summary.netValue += category.netValue;
        return categorySummary;
      });

      return {
        id: `${financialEntityId}-${year}`,
        categories,
        summary: {
          id: `${financialEntityId}-${year}`,
          originalCost: Math.round(summary.originalCost),
          reportYearDelta: Math.round(summary.reportYearDelta),
          totalDepreciableCosts: Math.round(summary.totalDepreciableCosts),
          reportYearClaimedDepreciation: Math.round(summary.reportYearClaimedDepreciation),
          pastYearsAccumulatedDepreciation: Math.round(summary.pastYearsAccumulatedDepreciation),
          totalDepreciation: Math.round(summary.totalDepreciation),
          netValue: Math.round(summary.netValue),
        },
        year,
      };
    },
  },
};
