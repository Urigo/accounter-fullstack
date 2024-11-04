import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBusinessMatchParams,
  IDeleteBusinessMatchQuery,
  IGetAllBusinessMatchesQuery,
  IGetBusinessesMatchesByIdsQuery,
  IInsertBusinessMatchParams,
  IInsertBusinessMatchQuery,
  IUpdateBusinessMatchParams,
  IUpdateBusinessMatchQuery,
} from '../types.js';

const getAllBusinessMatches = sql<IGetAllBusinessMatchesQuery>`
  SELECT *
  FROM accounter_schema.businesses_green_invoice_match;
`;

const getBusinessesMatchesByIds = sql<IGetBusinessesMatchesByIdsQuery>`
  SELECT *
  FROM accounter_schema.businesses_green_invoice_match
  WHERE business_id IN $$businessIds;
`;

const updateBusinessMatch = sql<IUpdateBusinessMatchQuery>`
  UPDATE accounter_schema.businesses_green_invoice_match
  SET
  green_invoice_id = COALESCE(
    $greenInvoiceId,
    green_invoice_id,
    NULL
  ),
  remark = COALESCE(
    $remark,
    remark,
    NULL
  ),
  emails = COALESCE(
    $emails,
    emails,
    NULL
  )
  WHERE
    business_id = $businessId
  RETURNING *;
`;

const deleteBusinessMatch = sql<IDeleteBusinessMatchQuery>`
  DELETE FROM accounter_schema.businesses_green_invoice_match
  WHERE business_id = $businessId
  RETURNING business_id;
`;

const insertBusinessMatch = sql<IInsertBusinessMatchQuery>`
    INSERT INTO accounter_schema.businesses_green_invoice_match (green_invoice_id)
    VALUES ($greenInvoiceId)
    RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessesGreenInvoiceMatcherProvider {
  cache = getCacheInstance({
    stdTTL: 24 * 60 * 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public async getAllBusinessMatches() {
    return getAllBusinessMatches.run(undefined, this.dbProvider);
  }

  private async batchBusinessesMatchByIds(ids: readonly string[]) {
    try {
      const matches = await getBusinessesMatchesByIds.run({ businessIds: ids }, this.dbProvider);

      return ids.map(id => matches.find(match => match.business_id === id));
    } catch (e) {
      console.error(e);
      return ids.map(() => undefined);
    }
  }

  public getBusinessMatchByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchBusinessesMatchByIds(keys),
    {
      cacheKeyFn: key => `business-match-id-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessesMatchByGreenInvoiceIds(greenInvoiceIds: readonly string[]) {
    try {
      const matches = await getBusinessesMatchesByIds.run(
        { businessIds: greenInvoiceIds },
        this.dbProvider,
      );

      return greenInvoiceIds.map(id => matches.find(match => match.green_invoice_id === id));
    } catch (e) {
      console.error(e);
      return greenInvoiceIds.map(() => undefined);
    }
  }

  public getBusinessMatchByGreenInvoiceIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchBusinessesMatchByGreenInvoiceIds(keys),
    {
      cacheKeyFn: key => `business-match-green-invoice-id-${key}`,
      cacheMap: this.cache,
    },
  );

  public async updateBusinessMatch(params: IUpdateBusinessMatchParams) {
    this.clearCache();
    return updateBusinessMatch.run(params, this.dbProvider);
  }

  public async deleteBusinessMatch(params: IDeleteBusinessMatchParams) {
    this.clearCache();
    return deleteBusinessMatch.run(params, this.dbProvider);
  }

  public async insertBusinessMatch(params: IInsertBusinessMatchParams) {
    this.clearCache();
    return insertBusinessMatch.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
