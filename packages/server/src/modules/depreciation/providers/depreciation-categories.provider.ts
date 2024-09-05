import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteDepreciationCategoryParams,
  IDeleteDepreciationCategoryQuery,
  IGetAllDepreciationCategoriesQuery,
  IGetAllDepreciationCategoriesResult,
  IGetDepreciationCategoriesByIdsQuery,
  IInsertDepreciationCategoryParams,
  IInsertDepreciationCategoryQuery,
  IUpdateDepreciationCategoryParams,
  IUpdateDepreciationCategoryQuery,
} from '../types.js';

const getAllDepreciationCategories = sql<IGetAllDepreciationCategoriesQuery>`
  SELECT *
  FROM accounter_schema.depreciation_categories`;

const getDepreciationCategoriesByIds = sql<IGetDepreciationCategoriesByIdsQuery>`
  SELECT *
  FROM accounter_schema.depreciation_categories
  WHERE id IN $$depreciationCategoriesIds;`;

const updateDepreciationCategory = sql<IUpdateDepreciationCategoryQuery>`
  UPDATE accounter_schema.depreciation_categories
  SET
  name = COALESCE(
    $name,
    name
  ),
  percentage = COALESCE(
    $percentage,
    percentage
  )
  WHERE
    id = $depreciationCategoryId
  RETURNING *;`;

const insertDepreciationCategory = sql<IInsertDepreciationCategoryQuery>`
  INSERT INTO accounter_schema.depreciation_categories (name, percentage)
  VALUES ($name, $percentage)
  RETURNING *`;

const deleteDepreciationCategory = sql<IDeleteDepreciationCategoryQuery>`
  DELETE FROM accounter_schema.depreciation
  WHERE id = $depreciationCategoryId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DepreciationCategoriesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60 * 24,
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllDepreciationCategories() {
    const data = this.cache.get('all-depreciation-categories');
    if (data) {
      return data as Array<IGetAllDepreciationCategoriesResult>;
    }
    return getAllDepreciationCategories.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-depreciation-categories', data, 60 * 60 * 24);
      return data;
    });
  }

  private async batchDepreciationCategoriesByIds(depreciationCategoriesIds: readonly string[]) {
    const categories = await getDepreciationCategoriesByIds.run(
      {
        depreciationCategoriesIds,
      },
      this.dbProvider,
    );
    return depreciationCategoriesIds.map(id => categories.find(category => category.id === id));
  }

  public getDepreciationCategoriesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchDepreciationCategoriesByIds(ids),
    {
      cacheKeyFn: key => `depreciation-category-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateDepreciationCategory(params: IUpdateDepreciationCategoryParams) {
    this.clearCache();
    return updateDepreciationCategory.run(params, this.dbProvider);
  }

  public insertDepreciationCategory(params: IInsertDepreciationCategoryParams) {
    this.clearCache();
    return insertDepreciationCategory.run(params, this.dbProvider);
  }

  public deleteDepreciationCategory(params: IDeleteDepreciationCategoryParams) {
    this.cache.clear();
    return deleteDepreciationCategory.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
