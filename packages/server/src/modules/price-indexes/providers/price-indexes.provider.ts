import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import {
  CPI_INDEX_CODE,
  linkAmount,
  resolvePoint,
  type PriceIndexPoint,
  type PriceIndexSeries,
} from '../helpers/price-index.helper.js';
import type {
  IGetPriceIndexBasesByCodesQuery,
  IGetPriceIndexValuesByCodesQuery,
} from '../types.js';

const getPriceIndexValuesByCodes = sql<IGetPriceIndexValuesByCodesQuery>`
  SELECT index_code, period, value, base_label, chained_value, monthly_change_pct, yearly_change_pct, published_on
  FROM accounter_schema.price_index_values
  WHERE index_code IN $$indexCodes
  ORDER BY index_code, period;
`;

const getPriceIndexBasesByCodes = sql<IGetPriceIndexBasesByCodesQuery>`
  SELECT index_code, base_label, first_period, chain_coefficient, chained_factor
  FROM accounter_schema.price_index_bases
  WHERE index_code IN $$indexCodes
  ORDER BY index_code, first_period;
`;

const toNumberOrNull = (value: string | null) => (value == null ? null : Number(value));

/**
 * Read access to CBS price indexes (CPI). The tables are global reference data, hence
 * `DBProvider`. Operation scope keeps the loaded series per request, so a sync is visible to the
 * next request without any cache invalidation. A whole series is ~900 rows; every lookup is then
 * answered in memory by the pure helpers in `price-index.helper.ts`.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class PriceIndexesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchSeriesByCodes(indexCodes: readonly number[]): Promise<PriceIndexSeries[]> {
    const [values, bases] = await Promise.all([
      getPriceIndexValuesByCodes.run({ indexCodes }, this.dbProvider),
      getPriceIndexBasesByCodes.run({ indexCodes }, this.dbProvider),
    ]);
    return indexCodes.map(indexCode => ({
      indexCode,
      rows: values
        .filter(row => row.index_code === indexCode)
        .map(row => ({
          indexCode,
          period: row.period,
          value: Number(row.value),
          baseLabel: row.base_label,
          chainedValue: Number(row.chained_value),
          monthlyChangePct: toNumberOrNull(row.monthly_change_pct),
          yearlyChangePct: toNumberOrNull(row.yearly_change_pct),
          publishedOn: row.published_on,
        })),
      bases: bases
        .filter(base => base.index_code === indexCode)
        .map(base => ({
          baseLabel: base.base_label,
          firstPeriod: base.first_period,
          chainCoefficient: toNumberOrNull(base.chain_coefficient),
          chainedFactor: Number(base.chained_factor),
        })),
    }));
  }

  public getSeriesLoader = new DataLoader((indexCodes: readonly number[]) =>
    this.batchSeriesByCodes(indexCodes),
  );

  public async getSeries(indexCode: number = CPI_INDEX_CODE) {
    return this.getSeriesLoader.load(indexCode);
  }

  /** The index last published before `date` (Income Tax Ordinance s.88 "known index") */
  public async getKnownIndexAt(date: TimelessDateString, indexCode: number = CPI_INDEX_CODE) {
    return resolvePoint(await this.getSeries(indexCode), { date, mode: 'KNOWN' });
  }

  /** The index for the month of `date` (מדד בגין) */
  public async getIndexForPeriod(date: TimelessDateString, indexCode: number = CPI_INDEX_CODE) {
    return resolvePoint(await this.getSeries(indexCode), { date, mode: 'FOR_PERIOD' });
  }

  public async linkAmount(
    amount: number,
    from: PriceIndexPoint,
    to: PriceIndexPoint,
    indexCode: number = CPI_INDEX_CODE,
  ) {
    return linkAmount(await this.getSeries(indexCode), amount, from, to);
  }
}
