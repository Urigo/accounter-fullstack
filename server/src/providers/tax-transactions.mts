import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { IGetTaxTransactionsByIDsQuery } from '../__generated__/tax-transactions.types.mjs';
import { pool } from './db.mjs';

const { sql } = pgQuery;

const getTaxTransactionsByIDs = sql<IGetTaxTransactionsByIDsQuery>`
    SELECT *
    FROM accounter_schema.taxes
    WHERE id IN (
        SELECT tax_id FROM accounter_schema.taxes_transactions
        WHERE transaction_id IN $$IDs
    );`;

async function batchTaxTransactionsByIDs(ids: readonly string[]) {
  const taxTransactions = await getTaxTransactionsByIDs.run(
    {
      IDs: ids,
    },
    pool,
  );
  return ids.map(id => taxTransactions.find(charge => charge.id === id));
}

export const getTaxTransactionsLoader = new DataLoader(batchTaxTransactionsByIDs, { cache: false });
