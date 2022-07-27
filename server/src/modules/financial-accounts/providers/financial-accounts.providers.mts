import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import type { Pool } from 'pg';

import {
  IGetFinancialAccountsByAccountNumbersQuery,
  IGetFinancialAccountsByFinancialEntityIdsQuery,
} from '../generated-types/financial-accounts.providers.types.mjs';

const { sql } = pgQuery;

const getFinancialAccountsByFinancialEntityIds = sql<IGetFinancialAccountsByFinancialEntityIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts
    WHERE owner IN $$financialEntityIds;`;

const getFinancialAccountsByAccountNumbers = sql<IGetFinancialAccountsByAccountNumbersQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts
    WHERE account_number IN $$accountNumbers;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialAccountsProvider {
  constructor(private pool: Pool) {}

  private batchFinancialAccountsByFinancialEntityIds = async (financialEntityIds: readonly string[]) => {
    const accounts = await getFinancialAccountsByFinancialEntityIds.run(
      {
        financialEntityIds,
      },
      this.pool
    );
    return financialEntityIds.map(financialEntityId => accounts.filter(charge => charge.owner === financialEntityId));
  };

  public getFinancialAccountsByFinancialEntityIdLoader = new DataLoader(
    this.batchFinancialAccountsByFinancialEntityIds,
    { cache: false }
  );

  private batchFinancialAccountsByAccountNumbers = async (accountNumbers: readonly number[]) => {
    const accounts = await getFinancialAccountsByAccountNumbers.run(
      {
        accountNumbers,
      },
      this.pool
    );
    return accountNumbers.map(accountNumber => accounts.find(charge => charge.account_number === accountNumber));
  };

  public getFinancialAccountByAccountNumberLoader = new DataLoader(this.batchFinancialAccountsByAccountNumbers, {
    cache: false,
  });
}
