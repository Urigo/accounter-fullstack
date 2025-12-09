import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../../modules/app-providers/db.provider.js';
import { getCacheInstance } from '../../../shared/helpers/index.js';
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
  scope: Scope.Singleton,
  global: true,
})
export class FinancialAccountsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

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
    {
      cacheKeyFn: key => `account-by-owner-id-${key}`,
      cacheMap: this.cache,
    },
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
      cacheKeyFn: key => `account-number-${key}`,
      cacheMap: this.cache,
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
      cacheKeyFn: key => `account-id-${key}`,
      cacheMap: this.cache,
    },
  );

  public getAllFinancialAccounts() {
    const cached = this.cache.get<IGetAllFinancialAccountsResult[]>('all-accounts');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllFinancialAccounts.run(undefined, this.dbProvider).then(res => {
      this.cache.set('all-accounts', res);
      res.map(account => {
        this.getFinancialAccountByAccountNumberLoader.prime(account.account_number, account);
        this.getFinancialAccountByAccountIDLoader.prime(account.id, account);
        if (account.owner) this.getFinancialAccountsByOwnerIdLoader.clear(account.owner);
      });
      return res;
    });
  }

  public async updateFinancialAccount(params: IUpdateFinancialAccountParams) {
    const updatedAccounts = await updateFinancialAccount.run(params, this.dbProvider);
    const updatedAccount = updatedAccounts[0];
    if (updatedAccount) {
      this.invalidateById(updatedAccount.id);
      this.getFinancialAccountByAccountIDLoader.prime(updatedAccount.id, updatedAccount);
    }
    return updatedAccount;
  }

  public async deleteFinancialAccount(params: IDeleteFinancialAccountParams) {
    if (params.financialAccountId) {
      await this.invalidateById(params.financialAccountId);
    }
    return deleteFinancialAccount.run(params, this.dbProvider);
  }

  public async insertFinancialAccounts(params: IInsertFinancialAccountsParams) {
    this.cache.delete('all-accounts');
    return insertFinancialAccounts.run(params, this.dbProvider);
  }

  public async invalidateById(financialAccountId: string) {
    const account = await this.getFinancialAccountByAccountIDLoader.load(financialAccountId);
    if (account) {
      if (account.owner) {
        this.getFinancialAccountsByOwnerIdLoader.clear(account.owner);
      }
      this.getFinancialAccountByAccountNumberLoader.clear(account.account_number);
    }
    this.cache.delete('all-accounts');
    this.getFinancialAccountByAccountIDLoader.clear(financialAccountId);
  }

  public clearCache() {
    this.cache.clear();
  }
}
