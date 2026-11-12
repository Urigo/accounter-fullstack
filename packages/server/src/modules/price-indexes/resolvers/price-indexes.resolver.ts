import { GraphQLError } from 'graphql';
import { YEAR_MONTH_REGEX } from '../../../shared/constants.js';
import { SuperAdminProvider } from '../../auth/providers/super-admin.provider.js';
import {
  CPI_INDEX_CODE,
  latestBase,
  periodToYearMonth,
  PriceIndexNotAvailableError,
  valueInBase,
  type PriceIndexBase,
  type PriceIndexRow,
  type PriceIndexSeries,
} from '../helpers/price-index.helper.js';
import { PriceIndexSyncProvider } from '../providers/price-index-sync.provider.js';
import { PriceIndexesProvider } from '../providers/price-indexes.provider.js';
import type { PriceIndexesModule } from '../types.js';

type PriceIndexType = 'CONSUMER_PRICE_INDEX';

const INDEX_CODES: Record<PriceIndexType, number> = {
  CONSUMER_PRICE_INDEX: CPI_INDEX_CODE,
};

function indexTypeByCode(indexCode: number): PriceIndexType {
  const entry = Object.entries(INDEX_CODES).find(([, code]) => code === indexCode);
  if (!entry) {
    throw new GraphQLError(`Unsupported price index code ${indexCode}`);
  }
  return entry[0] as PriceIndexType;
}

function toGraphQLValue(
  series: PriceIndexSeries,
  row: PriceIndexRow,
  latest: PriceIndexBase | undefined,
) {
  return {
    period: periodToYearMonth(row.period),
    value: row.value,
    base: row.baseLabel,
    valueInLatestBase: latest ? valueInBase(series, row, latest.baseLabel) : row.value,
    latestBase: latest?.baseLabel ?? row.baseLabel,
    monthlyChangePercent: row.monthlyChangePct,
    yearlyChangePercent: row.yearlyChangePct,
    publishedOn: row.publishedOn,
  };
}

export const priceIndexesResolvers: PriceIndexesModule.Resolvers = {
  Query: {
    priceIndexValues: async (_, { type, fromPeriod, toPeriod }, { injector }) => {
      if (!YEAR_MONTH_REGEX.test(fromPeriod) || !YEAR_MONTH_REGEX.test(toPeriod)) {
        throw new GraphQLError('Periods must be formatted as YYYY-MM', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const series = await injector.get(PriceIndexesProvider).getSeries(INDEX_CODES[type]);
      const latest = latestBase(series);
      return series.rows
        .filter(row => {
          const period = periodToYearMonth(row.period);
          return period >= fromPeriod && period <= toPeriod;
        })
        .map(row => toGraphQLValue(series, row, latest));
    },
    priceIndexLinkage: async (_, { type, amount, from, to }, { injector }) => {
      const provider = injector.get(PriceIndexesProvider);
      const indexCode = INDEX_CODES[type];
      try {
        const series = await provider.getSeries(indexCode);
        const linkage = await provider.linkAmount(
          amount,
          { date: from.date, mode: from.mode ?? 'KNOWN' },
          { date: to.date, mode: to.mode ?? 'KNOWN' },
          indexCode,
        );
        const latest = latestBase(series);
        return {
          ...linkage,
          fromIndex: toGraphQLValue(series, linkage.fromIndex, latest),
          toIndex: toGraphQLValue(series, linkage.toIndex, latest),
        };
      } catch (error) {
        if (error instanceof PriceIndexNotAvailableError) {
          throw new GraphQLError(error.message, { extensions: { code: 'BAD_USER_INPUT' } });
        }
        throw error;
      }
    },
  },
  Mutation: {
    syncPriceIndexes: async (_, { full }, { injector }) => {
      // Price indexes are global reference data, so tenant roles must not trigger writes
      await injector.get(SuperAdminProvider).requireSuperAdmin();
      try {
        const results = await injector.get(PriceIndexSyncProvider).sync({ full: !!full });
        return results.map(({ indexCode, ...result }) => ({
          type: indexTypeByCode(indexCode),
          ...result,
        }));
      } catch (error) {
        console.error('Error syncing price indexes', error);
        // super-admin only, so the underlying cause (e.g. CBS unreachable from this host) is safe to surface
        throw new GraphQLError(`Error syncing price indexes: ${(error as Error).message}`);
      }
    },
  },
};
