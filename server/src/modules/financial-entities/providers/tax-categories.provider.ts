import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllTaxCategoriesQuery,
  IGetAllTaxCategoriesResult,
  IGetTaxCategoryByBusinessAndOwnerIDsQuery,
  IGetTaxCategoryByChargeIDsQuery,
  IGetTaxCategoryByIDsQuery,
  IGetTaxCategoryByNamesQuery,
} from '../types.js';

const getTaxCategoryByBusinessAndOwnerIDs = sql<IGetTaxCategoryByBusinessAndOwnerIDsQuery>`
SELECT tc.*, tcm.business_id, tcm.owner_id
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.business_tax_category_match tcm ON tcm.tax_category_id = tc.id
WHERE tcm.business_id IN $$BusinessIds
AND tcm.owner_id IN $$OwnerIds;`;

const getTaxCategoryByChargeIDs = sql<IGetTaxCategoryByChargeIDsQuery>`
SELECT tc.*, c.business_id, c.owner_id, c.id as charge_id
FROM accounter_schema.extended_charges c
LEFT JOIN accounter_schema.tax_categories tc ON c.tax_category_id = tc.id
WHERE tc.id IS NOT NULL AND c.id IN $$chargeIds;`;

const getTaxCategoryByIDs = sql<IGetTaxCategoryByIDsQuery>`
SELECT *
FROM accounter_schema.tax_categories
WHERE id IN $$Ids;`;

const getTaxCategoryByNames = sql<IGetTaxCategoryByNamesQuery>`
SELECT *
FROM accounter_schema.tax_categories
WHERE name IN $$names;`;

const getAllTaxCategories = sql<IGetAllTaxCategoriesQuery>`
SELECT *
FROM accounter_schema.tax_categories;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TaxCategoriesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchTaxCategoryByBusinessAndOwnerIDs(
    entries: readonly { businessID: string; ownerID: string }[],
  ): Promise<(IGetAllTaxCategoriesResult | undefined)[]> {
    const BusinessIdsSet = new Set<string | null>(entries.map(e => e.businessID));
    const OwnerIdsSet = new Set<string | null>(entries.map(e => e.ownerID));

    const taxCategories = await getTaxCategoryByBusinessAndOwnerIDs.run(
      {
        BusinessIds: BusinessIdsSet.size === 0 ? [null] : Array.from(BusinessIdsSet),
        OwnerIds: OwnerIdsSet.size === 0 ? [null] : Array.from(OwnerIdsSet),
      },
      this.dbProvider,
    );
    return entries.map(({ businessID, ownerID }) =>
      taxCategories.find(tc => tc.business_id === businessID && tc.owner_id === ownerID),
    );
  }

  public taxCategoryByBusinessAndOwnerIDsLoader = new DataLoader(
    (keys: readonly { businessID: string; ownerID: string }[]) =>
      this.batchTaxCategoryByBusinessAndOwnerIDs(keys),
    {
      cache: false,
    },
  );

  private async batchTaxCategoryByChargeIDs(chargeIds: readonly string[]) {
    const taxCategories = await getTaxCategoryByChargeIDs.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => taxCategories.find(tc => tc.charge_id === id));
  }

  public taxCategoryByChargeIDsLoader = new DataLoader(
    (chargeIDs: readonly string[]) => this.batchTaxCategoryByChargeIDs(chargeIDs),
    {
      cache: false,
    },
  );

  private async batchTaxCategoryByIDs(Ids: readonly string[]) {
    const taxCategories = await getTaxCategoryByIDs.run(
      {
        Ids,
      },
      this.dbProvider,
    );
    return Ids.map(id => taxCategories.find(tc => tc.id === id));
  }

  public taxCategoryByIDsLoader = new DataLoader(
    (IDs: readonly string[]) => this.batchTaxCategoryByIDs(IDs),
    {
      cache: false,
    },
  );

  public getAllTaxCategories() {
    return getAllTaxCategories.run(undefined, this.dbProvider);
  }

  private async batchTaxCategoryByNames(names: readonly string[]) {
    const taxCategories = await getTaxCategoryByNames.run(
      {
        names,
      },
      this.dbProvider,
    );
    return names.map(name => taxCategories.find(tc => tc.name === name));
  }

  public taxCategoryByNamesLoader = new DataLoader(
    (names: readonly string[]) => this.batchTaxCategoryByNames(names),
    {
      cache: false,
    },
  );
}
