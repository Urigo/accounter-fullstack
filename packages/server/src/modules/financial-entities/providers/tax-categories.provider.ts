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
  IInsertBusinessTaxCategoryParams,
  IInsertBusinessTaxCategoryQuery,
  IUpdateBusinessTaxCategoryParams,
  IUpdateBusinessTaxCategoryQuery,
  IUpdateTaxCategoryParams,
  IUpdateTaxCategoryQuery,
} from '../types.js';

const getTaxCategoryByBusinessAndOwnerIDs = sql<IGetTaxCategoryByBusinessAndOwnerIDsQuery>`
SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, tc.hashavshevet_name, tcm.business_id, tcm.owner_id
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id
LEFT JOIN accounter_schema.business_tax_category_match tcm
  ON tcm.tax_category_id = tc.id
WHERE tcm.business_id IN $$BusinessIds
AND tcm.owner_id IN $$OwnerIds;`;

const getTaxCategoryByChargeIDs = sql<IGetTaxCategoryByChargeIDsQuery>`
SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, tc.hashavshevet_name, c.business_id, c.owner_id, c.id as charge_id
FROM accounter_schema.extended_charges c
LEFT JOIN accounter_schema.tax_categories tc
  ON c.tax_category_id = tc.id
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id
WHERE tc.id IS NOT NULL AND c.id IN $$chargeIds;`;

const getTaxCategoryByIDs = sql<IGetTaxCategoryByIDsQuery>`
SELECT fe.*, tc.hashavshevet_name
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id
WHERE tc.id IN $$Ids;`;

const getTaxCategoryByNames = sql<IGetTaxCategoryByNamesQuery>`
SELECT fe.*, tc.hashavshevet_name
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id
WHERE fe.name IN $$names;`;

const getAllTaxCategories = sql<IGetAllTaxCategoriesQuery>`
SELECT fe.*, tc.hashavshevet_name
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id;`;

const updateTaxCategory = sql<IUpdateTaxCategoryQuery>`
UPDATE accounter_schema.tax_categories
SET
hashavshevet_name = COALESCE(
  $hashavshevetName,
  hashavshevet_name
)
WHERE id = $taxCategoryId
RETURNING *;
`;

const updateBusinessTaxCategory = sql<IUpdateBusinessTaxCategoryQuery>`
UPDATE accounter_schema.business_tax_category_match
SET
tax_category_id = COALESCE(
  $taxCategoryId,
  tax_category_id
)
WHERE
  owner_id = $ownerId
  AND business_id = $businessId
RETURNING *;
`;

const insertBusinessTaxCategory = sql<IInsertBusinessTaxCategoryQuery>`
  INSERT INTO accounter_schema.business_tax_category_match (business_id, owner_id, tax_category_id)
  VALUES ($businessId, $ownerId, $taxCategoryId)
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TaxCategoriesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchTaxCategoryByBusinessAndOwnerIDs(
    entries: readonly { businessId: string; ownerId: string }[],
  ): Promise<(IGetAllTaxCategoriesResult | undefined)[]> {
    const BusinessIdsSet = new Set<string | null>(entries.map(e => e.businessId));
    const OwnerIdsSet = new Set<string | null>(entries.map(e => e.ownerId));

    const taxCategories = await getTaxCategoryByBusinessAndOwnerIDs.run(
      {
        BusinessIds: BusinessIdsSet.size === 0 ? [null] : Array.from(BusinessIdsSet),
        OwnerIds: OwnerIdsSet.size === 0 ? [null] : Array.from(OwnerIdsSet),
      },
      this.dbProvider,
    );
    return entries.map(({ businessId, ownerId }) =>
      taxCategories.find(tc => tc.business_id === businessId && tc.owner_id === ownerId),
    );
  }

  public taxCategoryByBusinessAndOwnerIDsLoader = new DataLoader(
    (keys: readonly { businessId: string; ownerId: string }[]) =>
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

  public updateTaxCategory(params: IUpdateTaxCategoryParams) {
    return updateTaxCategory.run(params, this.dbProvider);
  }

  public updateBusinessTaxCategory(params: IUpdateBusinessTaxCategoryParams) {
    return updateBusinessTaxCategory.run(params, this.dbProvider);
  }

  public insertBusinessTaxCategory(params: IInsertBusinessTaxCategoryParams) {
    return insertBusinessTaxCategory.run(params, this.dbProvider);
  }
}
