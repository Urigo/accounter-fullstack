import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { IGetTaxCategoryByBusinessAndOwnerIDsQuery } from '../__generated__/tax-categories.types.js';
import type {} from '../types.js';

const getTaxCategoryByBusinessAndOwnerIDs = sql<IGetTaxCategoryByBusinessAndOwnerIDsQuery>`
SELECT tc.*, tcm.business_id, tcm.owner_id
FROM accounter_schema.tax_categories tc
LEFT JOIN accounter_schema.business_tax_category_match tcm ON tcm.tax_category_id = tc.id
WHERE tcm.business_id IN $$BusinessIds
AND tcm.owner_id IN $$OwnerIds;`;

// type IGetBusinessTransactionsSumFromLedgerRecordsParamsAdjusted = Optional<
//   Omit<
//     IGetBusinessTransactionsSumFromLedgerRecordsParams,
//     'isBusinessIDs' | 'isFinancialEntityIds'
//   >,
//   'businessIDs' | 'financialEntityIds' | 'toDate' | 'fromDate'
// > & {
//   toDate?: TimelessDateString | null;
//   fromDate?: TimelessDateString | null;
// };

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
}
