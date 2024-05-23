import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllFinancialAccountsQuery,
  IGetFinancialAccountsByAccountIDsQuery,
  IGetFinancialAccountsByAccountNumbersQuery,
  IGetFinancialAccountsByOwnerIdsQuery,
} from '../types.js';

const getFinancialAccountsByOwnerIds = sql<IGetFinancialAccountsByOwnerIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts
    WHERE owner IN $$ownerIds;`;

const getFinancialAccountsByAccountNumbers = sql<IGetFinancialAccountsByAccountNumbersQuery>`
SELECT *
FROM accounter_schema.financial_accounts
WHERE account_number IN $$accountNumbers;`;

const getFinancialAccountsByAccountIDs = sql<IGetFinancialAccountsByAccountIDsQuery>`
SELECT *
FROM accounter_schema.financial_accounts
WHERE id IN $$accountIDs;`;

const getAllFinancialAccounts = sql<IGetAllFinancialAccountsQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialAccountsProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchFinancialAccountsByOwnerIds(ownerIds: readonly string[]) {
    const accounts = await getFinancialAccountsByOwnerIds.run(
      {
        ownerIds,
      },
      this.dbProvider,
    );
    return ownerIds.map(ownerId => accounts.filter(charge => charge.owner === ownerId));
  }

  public getFinancialAccountsByOwnerIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialAccountsByOwnerIds(keys),
    { cache: false },
  );

  private async batchFinancialAccountsByAccountNumbers(accountNumbers: readonly string[]) {
    const accounts = await getFinancialAccountsByAccountNumbers.run(
      {
        accountNumbers,
      },
      this.dbProvider,
    );
    return accountNumbers.map(accountNumber =>
      accounts.find(charge => charge.account_number === accountNumber),
    );
  }

  public getFinancialAccountByAccountNumberLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialAccountsByAccountNumbers(keys),
    {
      cache: false,
    },
  );

  private async batchFinancialAccountsByAccountIDs(accountIDs: readonly string[]) {
    const accounts = await getFinancialAccountsByAccountIDs.run(
      {
        accountIDs,
      },
      this.dbProvider,
    );
    return accountIDs.map(id => accounts.find(account => account.id === id));
  }

  public getFinancialAccountByAccountIDLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialAccountsByAccountIDs(keys),
    {
      cache: false,
    },
  );

  public getAllFinancialAccounts() {
    return getAllFinancialAccounts.run(undefined, this.dbProvider);
  }
}
