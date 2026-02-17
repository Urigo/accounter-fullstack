import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteFinancialAccountTaxCategoriesParams,
  IDeleteFinancialAccountTaxCategoriesQuery,
  IGetFinancialAccountTaxCategoriesByAccountIdsQuery,
  IInsertFinancialAccountTaxCategoriesParams,
  IInsertFinancialAccountTaxCategoriesQuery,
  IUpdateFinancialAccountTaxCategoryParams,
  IUpdateFinancialAccountTaxCategoryQuery,
} from '../types.js';

const getFinancialAccountTaxCategoriesByAccountIds = sql<IGetFinancialAccountTaxCategoriesByAccountIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts_tax_categories
    WHERE financial_account_id IN $$accountIds;`;

const updateFinancialAccountTaxCategory = sql<IUpdateFinancialAccountTaxCategoryQuery>`
      UPDATE accounter_schema.financial_accounts_tax_categories
      SET
      tax_category_id = COALESCE(
        $taxCategoryId,
        tax_category_id
      )
      WHERE
        financial_account_id = $financialAccountId
        AND currency = $currency
      RETURNING *;
    `;

const insertFinancialAccountTaxCategories = sql<IInsertFinancialAccountTaxCategoriesQuery>`
      INSERT INTO accounter_schema.financial_accounts_tax_categories (
        financial_account_id, currency, tax_category_id
      )
      VALUES $$financialAccountsTaxCategories(
        financial_account_id, currency, tax_category_id
      )
      RETURNING *;`;

const deleteFinancialAccountTaxCategories = sql<IDeleteFinancialAccountTaxCategoriesQuery>`
        DELETE FROM accounter_schema.financial_accounts_tax_categories
        WHERE financial_account_id = $financialAccountId
          AND currency IN $$currencies
        
        RETURNING *;
      `;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class FinancialAccountsTaxCategoriesProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchFinancialAccountTaxCategoriesByAccountIds(accountIds: readonly string[]) {
    const taxCategories = await getFinancialAccountTaxCategoriesByAccountIds.run(
      {
        accountIds,
      },
      this.db,
    );
    return accountIds.map(accountId =>
      taxCategories.filter(tc => tc.financial_account_id === accountId),
    );
  }

  public getFinancialAccountTaxCategoriesByFinancialAccountIdLoader = new DataLoader(
    (financialAccountId: readonly string[]) =>
      this.batchFinancialAccountTaxCategoriesByAccountIds(financialAccountId),
  );

  public async updateFinancialAccountTaxCategory(params: IUpdateFinancialAccountTaxCategoryParams) {
    if (params.financialAccountId) {
      this.invalidateByAccountId(params.financialAccountId);
    }
    return updateFinancialAccountTaxCategory.run(params, this.db);
  }

  public async deleteFinancialAccountTaxCategories(
    params: IDeleteFinancialAccountTaxCategoriesParams,
  ) {
    if (params.financialAccountId) {
      this.invalidateByAccountId(params.financialAccountId);
    }
    return deleteFinancialAccountTaxCategories.run(params, this.db);
  }

  public async insertFinancialAccountTaxCategories(
    params: IInsertFinancialAccountTaxCategoriesParams,
  ) {
    params.financialAccountsTaxCategories.map(tc => {
      if (tc.financial_account_id) {
        this.invalidateByAccountId(tc.financial_account_id);
      }
    });
    return insertFinancialAccountTaxCategories.run(params, this.db);
  }

  public invalidateByAccountId(financialAccountId: string) {
    this.getFinancialAccountTaxCategoriesByFinancialAccountIdLoader.clear(financialAccountId);
  }

  public clearCache() {
    this.getFinancialAccountTaxCategoriesByFinancialAccountIdLoader.clearAll();
  }
}
