import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { Currency } from '@shared/enums';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBusinessTaxCategoryParams,
  IDeleteBusinessTaxCategoryQuery,
  IDeleteTaxCategoryQuery,
  IGetAllTaxCategoriesQuery,
  IGetAllTaxCategoriesResult,
  IGetTaxCategoryByBusinessAndOwnerIDsQuery,
  IGetTaxCategoryByChargeIDsQuery,
  IGetTaxCategoryByFinancialAccountIdsAndCurrenciesQuery,
  IGetTaxCategoryByFinancialAccountIdsQuery,
  IGetTaxCategoryByFinancialAccountOwnerIdsQuery,
  IGetTaxCategoryByIDsQuery,
  IGetTaxCategoryBySortCodesQuery,
  IInsertBusinessTaxCategoryParams,
  IInsertBusinessTaxCategoryQuery,
  IInsertTaxCategoryParams,
  IInsertTaxCategoryQuery,
  IReplaceTaxCategoriesQuery,
  IUpdateBusinessTaxCategoryParams,
  IUpdateBusinessTaxCategoryQuery,
  IUpdateTaxCategoryParams,
  IUpdateTaxCategoryQuery,
} from '../types.js';

const getTaxCategoryByBusinessAndOwnerIDs = sql<IGetTaxCategoryByBusinessAndOwnerIDsQuery>`
SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.irs_code, fe.is_active, tc.hashavshevet_name, tc.tax_excluded, tcm.business_id, tcm.owner_id
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id
LEFT JOIN accounter_schema.business_tax_category_match tcm
  ON tcm.tax_category_id = tc.id
WHERE tcm.business_id IN $$BusinessIds
AND tcm.owner_id IN $$OwnerIds;`;

const getTaxCategoryBySortCodes = sql<IGetTaxCategoryBySortCodesQuery>`
SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.irs_code, fe.is_active, tc.hashavshevet_name, tc.tax_excluded, fe.owner_id
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id
WHERE fe.sort_code IN $$sortCodes;`;

const getTaxCategoryByFinancialAccountIdsAndCurrencies = sql<IGetTaxCategoryByFinancialAccountIdsAndCurrenciesQuery>`
SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.owner_id, fe.irs_code, fe.is_active, tc.hashavshevet_name, tc.tax_excluded, fatc.financial_account_id, fatc.currency
FROM accounter_schema.financial_accounts_tax_categories fatc
LEFT JOIN accounter_schema.tax_categories tc
  ON fatc.tax_category_id = tc.id
LEFT JOIN accounter_schema.financial_entities fe
  ON fatc.tax_category_id = fe.id
WHERE fatc.currency IN $$Currencies
AND fatc.financial_account_id IN $$FinancialAccountIds;`;

const getTaxCategoryByFinancialAccountOwnerIds = sql<IGetTaxCategoryByFinancialAccountOwnerIdsQuery>`
SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.owner_id, fe.irs_code, fe.is_active, tc.hashavshevet_name, tc.tax_excluded, fatc.financial_account_id, fatc.currency, fa.owner as "financial_account_owner_id"
FROM accounter_schema.financial_accounts_tax_categories fatc
LEFT JOIN accounter_schema.tax_categories tc
  ON fatc.tax_category_id = tc.id
LEFT JOIN accounter_schema.financial_entities fe
  ON fatc.tax_category_id = fe.id
LEFT JOIN accounter_schema.financial_accounts fa
  ON fa.id = fatc.financial_account_id
WHERE fa.owner IN $$ownerIds;`;

const getTaxCategoryByFinancialAccountIds = sql<IGetTaxCategoryByFinancialAccountIdsQuery>`
SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.owner_id, fe.irs_code, fe.is_active, tc.hashavshevet_name, tc.tax_excluded, fatc.financial_account_id, fatc.currency
FROM accounter_schema.financial_accounts_tax_categories fatc
LEFT JOIN accounter_schema.tax_categories tc
  ON fatc.tax_category_id = tc.id
LEFT JOIN accounter_schema.financial_entities fe
  ON fatc.tax_category_id = fe.id
WHERE fatc.financial_account_id IN $$financialAccountIds;`;

const getTaxCategoryByChargeIDs = sql<IGetTaxCategoryByChargeIDsQuery>`
SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.irs_code, fe.is_active, tc.hashavshevet_name, tc.tax_excluded, c.business_id, c.owner_id, c.id as charge_id
FROM accounter_schema.extended_charges c
LEFT JOIN accounter_schema.tax_categories tc
  ON c.tax_category_id = tc.id
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id
WHERE tc.id IS NOT NULL AND c.id IN $$chargeIds;`;

const getTaxCategoryByIDs = sql<IGetTaxCategoryByIDsQuery>`
SELECT fe.*, tc.hashavshevet_name, tc.tax_excluded
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id
WHERE tc.id IN $$Ids;`;

const getAllTaxCategories = sql<IGetAllTaxCategoriesQuery>`
SELECT fe.*, tc.hashavshevet_name, tc.tax_excluded
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.financial_entities fe
  ON fe.id = tc.id;`;

const updateTaxCategory = sql<IUpdateTaxCategoryQuery>`
UPDATE accounter_schema.tax_categories
SET
hashavshevet_name = COALESCE(
  $hashavshevetName,
  hashavshevet_name
),
tax_excluded = COALESCE(
  $taxExcluded,
  tax_excluded
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

const insertTaxCategory = sql<IInsertTaxCategoryQuery>`
  INSERT INTO accounter_schema.tax_categories (id, hashavshevet_name, tax_excluded)
  VALUES ($id, $hashavshevetName, $taxExcluded)
  RETURNING *;`;

const insertBusinessTaxCategory = sql<IInsertBusinessTaxCategoryQuery>`
  INSERT INTO accounter_schema.business_tax_category_match (business_id, owner_id, tax_category_id)
  VALUES ($businessId, $ownerId, $taxCategoryId)
  RETURNING *;`;

const deleteBusinessTaxCategory = sql<IDeleteBusinessTaxCategoryQuery>`
  DELETE FROM accounter_schema.business_tax_category_match
  WHERE
    business_id = $businessId
    AND owner_id = $ownerId
  RETURNING *;`;

const deleteTaxCategory = sql<IDeleteTaxCategoryQuery>`
  DELETE FROM accounter_schema.tax_categories
  WHERE
    id = $taxCategoryId
  RETURNING *;`;

const replaceTaxCategories = sql<IReplaceTaxCategoriesQuery>`
    WITH accounts AS (
      UPDATE accounter_schema.financial_accounts_tax_categories
      SET tax_category_id = $targetTaxCategoryId
      WHERE tax_category_id = $taxCategoryIdToReplace
      RETURNING financial_account_id
    ),
    business_match AS (
      UPDATE accounter_schema.business_tax_category_match
      SET tax_category_id = $targetTaxCategoryId
      WHERE tax_category_id = $taxCategoryIdToReplace
      RETURNING business_id
    )
    UPDATE accounter_schema.charges
      SET tax_category_id = $targetTaxCategoryId
      WHERE tax_category_id = $taxCategoryIdToReplace
    RETURNING id;
  `;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TaxCategoriesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

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
    return entries.map(
      ({ businessId, ownerId }) =>
        taxCategories.find(
          tc => tc.business_id === businessId && tc.owner_id === ownerId,
        ) as unknown as IGetAllTaxCategoriesResult | undefined, // TODO: temporary type casting, should be fixed later
    );
  }

  public taxCategoryByBusinessAndOwnerIDsLoader = new DataLoader(
    (keys: readonly { businessId: string; ownerId: string }[]) =>
      this.batchTaxCategoryByBusinessAndOwnerIDs(keys),
    {
      cache: false,
    },
  );

  private async batchTaxCategoryByIDs(
    ids: readonly string[],
  ): Promise<(IGetAllTaxCategoriesResult | undefined)[]> {
    const taxCategories = await getTaxCategoryByIDs.run(
      {
        Ids: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => taxCategories.find(tc => tc.id === id));
  }

  public taxCategoryByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchTaxCategoryByIDs(ids),
    {
      cache: false,
    },
  );

  private async batchTaxCategoriesBySortCodes(
    sortCodes: readonly number[],
  ): Promise<IGetAllTaxCategoriesResult[][]> {
    const taxCategories = await getTaxCategoryBySortCodes.run(
      {
        sortCodes: [...sortCodes],
      },
      this.dbProvider,
    );
    return sortCodes.map(sortCode => taxCategories.filter(tc => tc.sort_code === sortCode));
  }

  public taxCategoriesBySortCodeLoader = new DataLoader(
    (sortCodes: readonly number[]) => this.batchTaxCategoriesBySortCodes(sortCodes),
    {
      cache: false,
    },
  );

  private async batchTaxCategoryByFinancialAccountIdsAndCurrencies(
    entries: readonly { financialAccountId: string; currency: Currency }[],
  ): Promise<(IGetAllTaxCategoriesResult | undefined)[]> {
    const FinancialAccountIdsSet = new Set<string | null>(entries.map(e => e.financialAccountId));
    const CurrenciesSet = new Set<Currency | null>(entries.map(e => e.currency));

    const taxCategories = await getTaxCategoryByFinancialAccountIdsAndCurrencies.run(
      {
        FinancialAccountIds:
          FinancialAccountIdsSet.size === 0 ? [null] : Array.from(FinancialAccountIdsSet),
        Currencies: CurrenciesSet.size === 0 ? [null] : Array.from(CurrenciesSet),
      },
      this.dbProvider,
    );
    return entries.map(
      ({ financialAccountId, currency }) =>
        taxCategories.find(
          tc => tc.financial_account_id === financialAccountId && tc.currency === currency,
        ) as unknown as IGetAllTaxCategoriesResult | undefined, // TODO: temporary type casting, should be fixed later
    );
  }

  public taxCategoryByFinancialAccountIdsAndCurrenciesLoader = new DataLoader(
    (keys: readonly { financialAccountId: string; currency: Currency }[]) =>
      this.batchTaxCategoryByFinancialAccountIdsAndCurrencies(keys),
    {
      cache: false,
    },
  );

  private async batchTaxCategoryByFinancialAccountOwnerIds(ownerIds: readonly string[]) {
    const taxCategories = await getTaxCategoryByFinancialAccountOwnerIds.run(
      {
        ownerIds,
      },
      this.dbProvider,
    );
    return ownerIds.map(id => taxCategories.filter(tc => tc.financial_account_owner_id === id));
  }

  public taxCategoryByFinancialAccountOwnerIdsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTaxCategoryByFinancialAccountOwnerIds(keys),
    {
      cache: false,
    },
  );

  private async batchTaxCategoryByFinancialAccountIds(financialAccountIds: readonly string[]) {
    const taxCategories = await getTaxCategoryByFinancialAccountIds.run(
      {
        financialAccountIds,
      },
      this.dbProvider,
    );
    return financialAccountIds.map(id =>
      taxCategories.filter(tc => tc.financial_account_id === id),
    );
  }

  public taxCategoryByFinancialAccountIdsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTaxCategoryByFinancialAccountIds(keys),
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

  public getAllTaxCategories() {
    const data = this.cache.get<IGetAllTaxCategoriesResult[]>('all-tax-categories');
    if (data) {
      return Promise.resolve(data);
    }
    return getAllTaxCategories.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-tax-categories', data);
      data.map(taxCategory => {
        this.cache.set(`tax-category-${taxCategory.id}`, taxCategory);
      });
      return data;
    });
  }

  public updateTaxCategory(params: IUpdateTaxCategoryParams) {
    if (params.taxCategoryId) this.invalidateTaxCategoryById(params.taxCategoryId);
    return updateTaxCategory.run(params, this.dbProvider);
  }

  public updateBusinessTaxCategory(params: IUpdateBusinessTaxCategoryParams) {
    if (params.taxCategoryId) this.invalidateTaxCategoryById(params.taxCategoryId);
    return updateBusinessTaxCategory.run(params, this.dbProvider);
  }

  public insertTaxCategory(params: IInsertTaxCategoryParams) {
    if (!params.id) {
      throw new Error('Missing required parameters');
    }
    this.cache.delete('all-tax-categories');
    return insertTaxCategory.run(params, this.dbProvider).catch(error => {
      console.error(`Failed to insert tax category: ${error.message}`);
      throw error;
    });
  }

  public insertBusinessTaxCategory(params: IInsertBusinessTaxCategoryParams) {
    this.cache.delete('all-tax-categories');
    return insertBusinessTaxCategory.run(params, this.dbProvider);
  }

  public deleteBusinessTaxCategory(params: IDeleteBusinessTaxCategoryParams) {
    this.cache.delete('all-tax-categories');
    return deleteBusinessTaxCategory.run(params, this.dbProvider);
  }

  public async deleteTaxCategoryById(taxCategoryId: string) {
    const entity = await this.taxCategoryByIdLoader.load(taxCategoryId);
    if (!entity) {
      throw new Error(`Tax category with id ${taxCategoryId} not found`);
    }
    this.invalidateTaxCategoryById(taxCategoryId);

    // delete tax category
    deleteTaxCategory.run({ taxCategoryId }, this.dbProvider);
  }

  public async replaceTaxCategory(
    targetTaxCategoryId: string,
    taxCategoryIdToReplace: string,
    deleteTaxCategory: boolean = false,
  ) {
    const [taxCategoryToReplace, taxCategory] = await Promise.all([
      this.taxCategoryByIdLoader.load(targetTaxCategoryId),
      this.taxCategoryByIdLoader.load(taxCategoryIdToReplace),
    ]);
    if (!taxCategoryToReplace) {
      throw new Error(`Tax category with id ${taxCategoryIdToReplace} not found`);
    }
    if (!taxCategory) {
      throw new Error(`Tax category with id ${targetTaxCategoryId} not found`);
    }
    this.invalidateTaxCategoryById(taxCategoryIdToReplace);
    this.invalidateTaxCategoryById(targetTaxCategoryId);

    await replaceTaxCategories.run(
      {
        targetTaxCategoryId,
        taxCategoryIdToReplace,
      },
      this.dbProvider,
    );

    if (deleteTaxCategory) {
      await this.deleteTaxCategoryById(taxCategoryIdToReplace);
    }
  }

  public invalidateTaxCategoryById(taxCategoryId: string) {
    this.cache.delete(`tax-category-${taxCategoryId}`);
    this.cache.delete('all-tax-categories');
  }

  public clearCache() {
    this.cache.clear();
  }
}
