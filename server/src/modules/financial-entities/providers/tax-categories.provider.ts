import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllTaxCategoriesQuery,
  IGetTaxCategoryByBusinessAndOwnerIDsQuery,
  IGetTaxCategoryByChargeIDsQuery,
  IGetTaxCategoryByIDsQuery,
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
WHERE c.id IN $$chargeIds;`;

const getTaxCategoryByIDs = sql<IGetTaxCategoryByIDsQuery>`
SELECT *
FROM accounter_schema.tax_categories
WHERE id IN $$Ids;`;

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
  ) {
    const BusinessIdsSet = new Set<string | null>(entries.map(e => e.businessID));
    const OwnerIdsSet = new Set<string | null>(entries.map(e => e.ownerID));

    const BusinessIds = Array.from(BusinessIdsSet);
    const OwnerIds = Array.from(OwnerIdsSet);

    // if array is empty, add null to it to avoid gptyped error
    if (BusinessIds.length === 0) {
      BusinessIds.push(null);
    }
    if (OwnerIds.length === 0) {
      OwnerIds.push(null);
    }
    const taxCategories = await getTaxCategoryByBusinessAndOwnerIDs.run(
      {
        BusinessIds,
        OwnerIds,
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
}
