import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IGetAllDividendsParams,
  IGetAllDividendsQuery,
  IGetAllDividendsResult,
  IGetDividendsByBusinessIdsQuery,
  IGetDividendsByChargeIdQuery,
} from '../types.js';

const getAllDividends = sql<IGetAllDividendsQuery>`
  SELECT *
  FROM accounter_schema.dividends
  ORDER BY date DESC;
`;

const getDividendsByChargeId = sql<IGetDividendsByChargeIdQuery>`
  SELECT d.*, t.charge_id
  FROM accounter_schema.dividends d
  LEFT JOIN accounter_schema.transactions t
  ON d.transaction_id = t.id
  WHERE t.charge_id in $$chargeIds
  ORDER BY date DESC;
`;

const getDividendsByBusinessIds = sql<IGetDividendsByBusinessIdsQuery>`
  SELECT *
  FROM accounter_schema.dividends
  WHERE business_id IN $$businessIds
  ORDER BY date DESC;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DividendsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public async getAllDividends(params: IGetAllDividendsParams) {
    const cached = this.cache.get<IGetAllDividendsResult[]>('all-dividends');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllDividends.run(params, this.dbProvider).then(res => {
      if (res) {
        this.cache.set('all-dividends', res);
      }
      return res;
    });
  }

  private async batchDividendsByChargeIds(chargeIds: readonly string[]) {
    try {
      const dividends = await getDividendsByChargeId.run({ chargeIds }, this.dbProvider);

      return chargeIds.map(id => dividends.filter(dividend => dividend.charge_id === id));
    } catch (e) {
      console.error(e);
      return chargeIds.map(() => []);
    }
  }

  public getDividendsByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchDividendsByChargeIds(keys),
    {
      cacheKeyFn: key => `dividends-by-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchDividendsByBusinessIds(businessIds: readonly string[]) {
    try {
      const dividends = await getDividendsByBusinessIds.run({ businessIds }, this.dbProvider);

      return businessIds.map(id => dividends.filter(dividend => dividend.business_id === id));
    } catch (e) {
      console.error(e);
      return businessIds.map(() => []);
    }
  }

  public getDividendsByBusinessIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchDividendsByBusinessIds(keys),
    {
      cacheKeyFn: key => `dividends-by-business-${key}`,
      cacheMap: this.cache,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
