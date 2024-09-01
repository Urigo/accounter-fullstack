import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteDeprecationCategoryParams,
  IDeleteDeprecationCategoryQuery,
  IGetAllDeprecationCategoriesQuery,
  IGetAllDeprecationCategoriesResult,
  IGetDeprecationCategoriesByIdsQuery,
  IInsertDeprecationCategoryParams,
  IInsertDeprecationCategoryQuery,
  IUpdateDeprecationCategoryParams,
  IUpdateDeprecationCategoryQuery,
} from '../types.js';

const getAllDeprecationCategories = sql<IGetAllDeprecationCategoriesQuery>`
  SELECT *
  FROM accounter_schema.deprecation_categories`;

const getDeprecationCategoriesByIds = sql<IGetDeprecationCategoriesByIdsQuery>`
  SELECT *
  FROM accounter_schema.deprecation_categories
  WHERE id IN $$deprecationCategoriesIds;`;

const updateDeprecationCategory = sql<IUpdateDeprecationCategoryQuery>`
  UPDATE accounter_schema.deprecation_categories
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
    id = $deprecationCategoryId
  RETURNING *;`;

const insertDeprecationCategory = sql<IInsertDeprecationCategoryQuery>`
  INSERT INTO accounter_schema.deprecation_categories (name, percentage)
  VALUES ($name, $percentage)
  RETURNING *`;

const deleteDeprecationCategory = sql<IDeleteDeprecationCategoryQuery>`
  DELETE FROM accounter_schema.deprecation
  WHERE id = $deprecationCategoryId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DeprecationCategoriesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60 * 24,
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllDeprecationCategories() {
    const data = this.cache.get('all-deprecation-categories');
    if (data) {
      return data as Array<IGetAllDeprecationCategoriesResult>;
    }
    return getAllDeprecationCategories.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-deprecation-categories', data, 60 * 60 * 24);
      return data;
    });
  }

  private async batchDeprecationCategoriesByIds(deprecationCategoriesIds: readonly string[]) {
    const categories = await getDeprecationCategoriesByIds.run(
      {
        deprecationCategoriesIds,
      },
      this.dbProvider,
    );
    return deprecationCategoriesIds.map(id => categories.find(category => category.id === id));
  }

  public getDeprecationCategoriesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchDeprecationCategoriesByIds(ids),
    {
      cacheKeyFn: key => `deprecation-category-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateDeprecationCategory(params: IUpdateDeprecationCategoryParams) {
    this.clearCache();
    return updateDeprecationCategory.run(params, this.dbProvider);
  }

  public insertDeprecationCategory(params: IInsertDeprecationCategoryParams) {
    this.clearCache();
    return insertDeprecationCategory.run(params, this.dbProvider);
  }

  public deleteDeprecationCategory(params: IDeleteDeprecationCategoryParams) {
    this.cache.clear();
    return deleteDeprecationCategory.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
