import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBusinessMatchQuery,
  IGetAllBusinessMatchesQuery,
  IGetAllBusinessMatchesResult,
  IGetBusinessesMatchesByGreenInvoiceIdsQuery,
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

const getBusinessesMatchesByGreenInvoiceIds = sql<IGetBusinessesMatchesByGreenInvoiceIdsQuery>`
  SELECT *
  FROM accounter_schema.businesses_green_invoice_match
  WHERE green_invoice_id IN $$greenInvoiceBusinessIds;
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
  ),
  business_id = COALESCE(
    $newBusinessId,
    business_id,
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
    stdTTL: 60 * 60 * 24, // 24 hours
  });

  constructor(private dbProvider: DBProvider) {}

  public async getAllBusinessMatches() {
    const cache = this.cache.get<IGetAllBusinessMatchesResult[]>('all-business-matches');
    if (cache) {
      return Promise.resolve(cache);
    }
    return getAllBusinessMatches.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-business-matches', data);
      data.map(businessMatch => {
        this.cache.set(`business-match-id-${businessMatch.business_id}`, businessMatch);
        this.cache.set(
          `business-match-green-invoice-id-${businessMatch.green_invoice_id}`,
          businessMatch,
        );
      });
      return data;
    });
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
      const matches = await getBusinessesMatchesByGreenInvoiceIds.run(
        { greenInvoiceBusinessIds: greenInvoiceIds },
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

  public async deleteBusinessMatch(businessId: string) {
    this.clearCache();
    return deleteBusinessMatch.run({ businessId }, this.dbProvider);
  }

  public async insertBusinessMatch(params: IInsertBusinessMatchParams) {
    this.clearCache();
    return insertBusinessMatch.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
