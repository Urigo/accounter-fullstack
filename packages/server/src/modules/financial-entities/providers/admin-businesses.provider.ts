import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetAdminBusinessesByIdsQuery,
  IGetAllAdminBusinessesQuery,
  IGetAllAdminBusinessesResult,
} from '../types.js';

const getAdminBusinessesByIds = sql<IGetAdminBusinessesByIdsQuery>`
    SELECT ab.*, f.name, b.vat_number
    FROM accounter_schema.businesses_admin ab
    INNER JOIN accounter_schema.businesses b
      USING (id)
    INNER JOIN accounter_schema.financial_entities f
      USING (id)
    WHERE ab.id IN $$ids;`;

const getAllAdminBusinesses = sql<IGetAllAdminBusinessesQuery>`
    SELECT ab.*, f.name, b.vat_number
    FROM accounter_schema.businesses_admin ab
    INNER JOIN accounter_schema.businesses b
      USING (id)
    INNER JOIN accounter_schema.financial_entities f
      USING (id)
    INNER JOIN accounter_schema.financial_entities fe
      USING (id);`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AdminBusinessesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchAdminBusinessesByIds(ids: readonly string[]) {
    const uniqueIds = [...new Set(ids)];
    const adminBusinesses = await getAdminBusinessesByIds.run(
      {
        ids: uniqueIds,
      },
      this.dbProvider,
    );
    return ids.map(id => adminBusinesses.find(admin => admin.id === id));
  }

  public getAdminBusinessByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchAdminBusinessesByIds(ids),
    {
      cacheKeyFn: id => `admin-business-${id}`,
      cacheMap: this.cache,
    },
  );

  public getAllAdminBusinesses() {
    const data = this.cache.get<IGetAllAdminBusinessesResult[]>('all-admin-businesses');
    if (data) {
      return Promise.resolve(data);
    }
    return getAllAdminBusinesses.run(undefined, this.dbProvider).then(result => {
      this.cache.set('all-admin-businesses', result);
      return result;
    });
  }

  public clearCache() {
    this.cache.clear();
  }
}
