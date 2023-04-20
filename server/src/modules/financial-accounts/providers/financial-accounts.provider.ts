import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetFinancialAccountsByAccountIDsQuery,
  IGetFinancialAccountsByAccountNumbersQuery,
  IGetFinancialAccountsByFinancialEntityIdsQuery,
} from '../types.js';

const getFinancialAccountsByFinancialEntityIds = sql<IGetFinancialAccountsByFinancialEntityIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts
    WHERE owner IN $$financialEntityIds;`;

const getFinancialAccountsByAccountNumbers = sql<IGetFinancialAccountsByAccountNumbersQuery>`
SELECT *
FROM accounter_schema.financial_accounts
WHERE account_number IN $$accountNumbers;`;

const getFinancialAccountsByAccountIDs = sql<IGetFinancialAccountsByAccountIDsQuery>`
SELECT *
FROM accounter_schema.financial_accounts
WHERE id IN $$accountIDs;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialAccountsProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchFinancialAccountsByFinancialEntityIds(financialEntityIds: readonly string[]) {
    const accounts = await getFinancialAccountsByFinancialEntityIds.run(
      {
        financialEntityIds,
      },
      this.dbProvider,
    );
    return financialEntityIds.map(financialEntityId =>
      accounts.filter(charge => charge.owner === financialEntityId),
    );
  }

  public getFinancialAccountsByFinancialEntityIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialAccountsByFinancialEntityIds(keys),
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
    return accountIDs.map(id => accounts.find(charge => charge.id === id));
  }

  public getFinancialAccountByAccountIDLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialAccountsByAccountIDs(keys),
    {
      cache: false,
    },
  );
}
