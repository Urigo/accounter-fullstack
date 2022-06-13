import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { pool } from './db.mjs';
import {
  IGetFinancialAccountsByFinancialEntityIdsQuery,
  IGetFinancialAccountsByAccountNumbersQuery,
} from '../__generated__/financialAccounts.types.mjs';

const { sql } = pgQuery;

const getFinancialAccountsByFinancialEntityIds = sql<IGetFinancialAccountsByFinancialEntityIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts
    WHERE owner IN $$financialEntityIds;`;

async function batchFinancialAccountsByFinancialEntityIds(financialEntityIds: readonly string[]) {
  const accounts = await getFinancialAccountsByFinancialEntityIds.run(
    {
      financialEntityIds,
    },
    pool
  );
  return financialEntityIds.map(financialEntityId => accounts.filter(charge => charge.owner === financialEntityId));
}

export const getFinancialAccountsByFinancialEntityIdLoader = new DataLoader(
  batchFinancialAccountsByFinancialEntityIds,
  { cache: false }
);

const getFinancialAccountsByAccountNumbers = sql<IGetFinancialAccountsByAccountNumbersQuery>`
SELECT *
FROM accounter_schema.financial_accounts
WHERE account_number IN $$accountNumbers;`;

async function batchFinancialAccountsByAccountNumbers(accountNumbers: readonly number[]) {
  const accounts = await getFinancialAccountsByAccountNumbers.run(
    {
      accountNumbers,
    },
    pool
  );
  return accountNumbers.map(accountNumber => accounts.find(charge => charge.account_number === accountNumber));
}

export const getFinancialAccountByAccountNumberLoader = new DataLoader(batchFinancialAccountsByAccountNumbers, {
  cache: false,
});
