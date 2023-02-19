import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type { IGetTaxTransactionsByIDsQuery } from '../types.js';

const getTaxTransactionsByIDs = sql<IGetTaxTransactionsByIDsQuery>`
    SELECT *
    FROM accounter_schema.taxes
    WHERE id IN (
        SELECT tax_id FROM accounter_schema.taxes_transactions
        WHERE transaction_id IN $$IDs
    );`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TaxTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchTaxTransactionsByIDs(ids: readonly string[]) {
    const taxTransactions = await getTaxTransactionsByIDs.run(
      {
        IDs: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => taxTransactions.find(charge => charge.id === id));
  }

  public getTaxTransactionsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTaxTransactionsByIDs(keys),
    {
      cache: false,
    },
  );
}
