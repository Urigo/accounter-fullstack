import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from 'modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllDividendsParams,
  IGetAllDividendsQuery,
  IGetDividendsByBusinessIdsParams,
  IGetDividendsByBusinessIdsQuery,
  IGetDividendsByChargeIdQuery,
} from '../types.js';

const getAllDividends = sql<IGetAllDividendsQuery>`
  SELECT *
  FROM accounter_schema.dividends
  ORDER BY date DESC;
`;

const getDividendsByChargeId = sql<IGetDividendsByChargeIdQuery>`
  SELECT *
  FROM accounter_schema.dividends
  WHERE charge_id in $$chargeIds
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
  constructor(private dbProvider: DBProvider) {}

  public async getAllDividends(params: IGetAllDividendsParams) {
    return getAllDividends.run(params, this.dbProvider);
  }

  private async batchDividendsByChargeIds(chargeIds: readonly string[]) {
    const uniqueIDs = [...new Set(chargeIds)];
    try {
      const dividends = await getDividendsByChargeId.run({ chargeIds: uniqueIDs }, this.dbProvider);

      return chargeIds.map(id => dividends.filter(dividend => dividend.charge_id === id));
    } catch (e) {
      console.error(e);
      return chargeIds.map(() => []);
    }
  }

  public getDividendsByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchDividendsByChargeIds(keys),
    {
      cache: false,
    },
  );

  public async getDividendsByBusinessIds(params: IGetDividendsByBusinessIdsParams) {
    return getDividendsByBusinessIds.run(params, this.dbProvider);
  }
}
