import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
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
  scope: Scope.Operation,
  global: true,
})
export class DividendsProvider {
  constructor(private dbProvider: DBProvider) {}

  private allDividendsCache: Promise<IGetAllDividendsResult[]> | null = null;
  public getAllDividends() {
    if (this.allDividendsCache) {
      return this.allDividendsCache;
    }
    this.allDividendsCache = getAllDividends.run(undefined, this.dbProvider);
    return this.allDividendsCache;
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

  public getDividendsByChargeIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchDividendsByChargeIds(keys),
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

  public getDividendsByBusinessIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchDividendsByBusinessIds(keys),
  );

  public clearCache() {
    this.getDividendsByChargeIdLoader.clearAll();
    this.getDividendsByBusinessIdLoader.clearAll();
  }
}
