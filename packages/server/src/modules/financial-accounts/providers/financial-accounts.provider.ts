import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteFinancialAccountParams,
  IDeleteFinancialAccountQuery,
  IGetAllFinancialAccountsQuery,
  IGetAllFinancialAccountsResult,
  IGetFinancialAccountsByAccountIDsQuery,
  IGetFinancialAccountsByAccountNumbersQuery,
  IGetFinancialAccountsByOwnerIdsQuery,
  IInsertFinancialAccountsParams,
  IInsertFinancialAccountsQuery,
  IUpdateFinancialAccountParams,
  IUpdateFinancialAccountQuery,
} from '../types.js';

const getFinancialAccountsByOwnerIds = sql<IGetFinancialAccountsByOwnerIdsQuery>`
    SELECT id, account_number, account_name, private_business, owner, type
    FROM accounter_schema.financial_accounts
    WHERE owner IN $$ownerIds;`;

const getFinancialAccountsByAccountNumbers = sql<IGetFinancialAccountsByAccountNumbersQuery>`
SELECT id, account_number, account_name, private_business, owner, type
FROM accounter_schema.financial_accounts
WHERE account_number IN $$accountNumbers;`;

const getFinancialAccountsByAccountIDs = sql<IGetFinancialAccountsByAccountIDsQuery>`
SELECT id, account_number, account_name, private_business, owner, type
FROM accounter_schema.financial_accounts
WHERE id IN $$accountIDs;`;

const getAllFinancialAccounts = sql<IGetAllFinancialAccountsQuery>`
    SELECT id, account_number, account_name, private_business, owner, type
    FROM accounter_schema.financial_accounts;`;

const updateFinancialAccount = sql<IUpdateFinancialAccountQuery>`
      UPDATE accounter_schema.financial_accounts
      SET
      account_number = COALESCE(
        $accountNumber,
        account_number
      ),
      account_name = COALESCE(
        $name,
        account_name
      ),
      private_business = COALESCE(
        $privateBusiness,
        private_business
      ),
      owner = COALESCE(
        $ownerId,
        owner
      ),
      type = COALESCE(
        $type,
        type
      )
      WHERE
        id = $financialAccountId
      RETURNING *;
    `;

const insertFinancialAccounts = sql<IInsertFinancialAccountsQuery>`
      INSERT INTO accounter_schema.financial_accounts (
        account_number, account_name, private_business, owner, type
      )
      VALUES $$bankAccounts(
        accountNumber, name, privateBusiness, ownerId, type
      )
      RETURNING *;`;

const deleteFinancialAccount = sql<IDeleteFinancialAccountQuery>`
        DELETE FROM accounter_schema.financial_accounts
        WHERE id = $financialAccountId
        RETURNING id;
      `;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class FinancialAccountsProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchFinancialAccountsByOwnerIds(ownerIds: readonly string[]) {
    const accounts = await getFinancialAccountsByOwnerIds.run(
      {
        ownerIds,
      },
      this.db,
    );
    return ownerIds.map(ownerId => accounts.filter(charge => charge.owner === ownerId));
  }

  public getFinancialAccountsByOwnerIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchFinancialAccountsByOwnerIds(keys),
  );

  private async batchFinancialAccountsByAccountNumbers(accountNumbers: readonly string[]) {
    const accounts = await getFinancialAccountsByAccountNumbers.run(
      {
        accountNumbers,
      },
      this.db,
    );
    return accountNumbers.map(accountNumber =>
      accounts.find(charge => charge.account_number === accountNumber),
    );
  }

  public getFinancialAccountByAccountNumberLoader = new DataLoader((keys: readonly string[]) =>
    this.batchFinancialAccountsByAccountNumbers(keys),
  );

  private async batchFinancialAccountsByAccountIDs(accountIDs: readonly string[]) {
    const accounts = await getFinancialAccountsByAccountIDs.run(
      {
        accountIDs,
      },
      this.db,
    );
    return accountIDs.map(id => accounts.find(account => account.id === id));
  }

  public getFinancialAccountByAccountIDLoader = new DataLoader((keys: readonly string[]) =>
    this.batchFinancialAccountsByAccountIDs(keys),
  );

  private allFinancialAccountsCache: Promise<IGetAllFinancialAccountsResult[]> | null = null;
  public getAllFinancialAccounts() {
    if (this.allFinancialAccountsCache) {
      return this.allFinancialAccountsCache;
    }
    const result = getAllFinancialAccounts.run(undefined, this.db).then(accounts => {
      accounts.map(account => {
        this.getFinancialAccountByAccountIDLoader.prime(account.id, account);
        this.getFinancialAccountByAccountNumberLoader.prime(account.account_number, account);
      });
      return accounts;
    });
    this.allFinancialAccountsCache = result;
    return result;
  }

  public async updateFinancialAccount(params: IUpdateFinancialAccountParams) {
    const updatedAccounts = await updateFinancialAccount.run(params, this.db);
    const updatedAccount = updatedAccounts[0];
    if (updatedAccount) {
      this.invalidateById(updatedAccount.id);
    }
    return updatedAccount;
  }

  public async deleteFinancialAccount(params: IDeleteFinancialAccountParams) {
    if (params.financialAccountId) {
      this.invalidateById(params.financialAccountId);
    }
    return deleteFinancialAccount.run(params, this.db);
  }

  public async insertFinancialAccounts(params: IInsertFinancialAccountsParams) {
    this.allFinancialAccountsCache = null;
    return insertFinancialAccounts.run(params, this.db);
  }

  public invalidateById(financialAccountId: string) {
    this.getFinancialAccountByAccountIDLoader.clear(financialAccountId);
    this.getFinancialAccountsByOwnerIdLoader.clearAll();
    this.getFinancialAccountByAccountNumberLoader.clearAll();
    this.allFinancialAccountsCache = null;
  }

  public clearCache() {
    this.getFinancialAccountsByOwnerIdLoader.clearAll();
    this.getFinancialAccountByAccountNumberLoader.clearAll();
    this.getFinancialAccountByAccountIDLoader.clearAll();
    this.allFinancialAccountsCache = null;
  }
}
