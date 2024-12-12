import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetAllFinancialEntitiesQuery,
  IGetAllFinancialEntitiesResult,
  IGetFinancialEntitiesByIdsQuery,
  IInsertFinancialEntityParams,
  IInsertFinancialEntityQuery,
  IUpdateFinancialEntityParams,
  IUpdateFinancialEntityQuery,
} from '../types.js';
import { BusinessesProvider } from './businesses.provider.js';
import { TaxCategoriesProvider } from './tax-categories.provider.js';

const getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_entities
    WHERE id IN $$ids;`;

const getAllFinancialEntities = sql<IGetAllFinancialEntitiesQuery>`
    SELECT *
    FROM accounter_schema.financial_entities;`;

const updateFinancialEntity = sql<IUpdateFinancialEntityQuery>`
  UPDATE accounter_schema.financial_entities
  SET
  name = COALESCE(
    $name,
    name
  ),
  owner_id = COALESCE(
    $ownerId,
    owner_id
  ),
  sort_code = COALESCE(
    $sortCode,
    sort_code
  ),
  type = COALESCE(
    $type,
    type
  )
  WHERE
    id = $financialEntityId
  RETURNING *;
`;

const insertFinancialEntity = sql<IInsertFinancialEntityQuery>`
  INSERT INTO accounter_schema.financial_entities (type, owner_id, name, sort_code)
  VALUES($type, $ownerId, $name, $sortCode)
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialEntitiesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(
    private dbProvider: DBProvider,
    private businessesProvider: BusinessesProvider,
    private taxCategoriesProvider: TaxCategoriesProvider,
  ) {}

  private async batchFinancialEntitiesByIds(ids: readonly string[]) {
    const uniqueIds = [...new Set(ids)];
    const financialEntities = await getFinancialEntitiesByIds.run(
      {
        ids: uniqueIds,
      },
      this.dbProvider,
    );
    return ids.map(id => financialEntities.find(fe => fe.id === id));
  }

  public getFinancialEntityByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialEntitiesByIds(keys),
    {
      cacheKeyFn: key => `financial-entity-id-${key}`,
      cacheMap: this.cache,
    },
  );

  public getAllFinancialEntities() {
    const data = this.cache.get('all-financial-entities');
    if (data) {
      return data as Array<IGetAllFinancialEntitiesResult>;
    }
    return getAllFinancialEntities.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-financial-entities', data);
      data.map(fe => {
        this.cache.set(`financial-entity-id-${fe.id}`, fe);
      });
      return data;
    });
  }

  public updateFinancialEntity(params: IUpdateFinancialEntityParams) {
    if (params.financialEntityId) {
      this.invalidateFinancialEntityById(params.financialEntityId);
    }
    return updateFinancialEntity.run(params, this.dbProvider);
  }

  public insertFinancialEntity(params: IInsertFinancialEntityParams) {
    this.cache.delete('all-financial-entities');
    return insertFinancialEntity.run(params, this.dbProvider);
  }

  public invalidateFinancialEntityById(financialEntityId: string) {
    this.businessesProvider.invalidateBusinessById(financialEntityId);
    this.taxCategoriesProvider.invalidateTaxCategoryById(financialEntityId);
    this.cache.delete('all-financial-entities');
    this.cache.delete(`financial-entity-id-${financialEntityId}`);
  }

  public clearCache() {
    this.taxCategoriesProvider.clearCache();
    this.businessesProvider.clearCache();
    this.cache.clear();
  }
}
