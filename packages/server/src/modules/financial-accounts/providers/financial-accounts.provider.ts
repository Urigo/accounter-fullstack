import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteFinancialAccountParams,
  IDeleteFinancialAccountQuery,
  IGetAllFinancialAccountsQuery,
  IGetAllFinancialAccountsResult,
  IGetFinancialAccountsByAccountIDsQuery,
  IGetFinancialAccountsByAccountNumbersQuery,
  IGetFinancialAccountsByOwnerIdsQuery,
  IGetLatestAccountBalancesParams,
  IGetLatestAccountBalancesQuery,
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
        account_number, account_name, private_business, owner, type, owner_id
      )
      VALUES $$bankAccounts(
        accountNumber, name, privateBusiness, ownerId, type, ownerId
      )
      RETURNING *;`;

const deleteFinancialAccount = sql<IDeleteFinancialAccountQuery>`
        DELETE FROM accounter_schema.financial_accounts
        WHERE id = $financialAccountId
        RETURNING id;
      `;

/**
 * The bank's own running balance, read off the newest ingested transaction per
 * (account, currency). Banks report the balance after every movement
 * (`transactions.current_balance`), so the latest row is the latest balance the
 * bank told us about. Same-day ties are broken by the bank's own sequence:
 * `serial_number` for Poalim ILS rows, `event_number` for Poalim foreign-currency
 * rows, then insertion time for every other source.
 */
const getLatestAccountBalances = sql<IGetLatestAccountBalancesQuery>`
  SELECT DISTINCT ON (t.account_id, t.currency)
    t.id AS transaction_id,
    t.account_id,
    t.owner_id,
    t.currency::TEXT AS currency,
    t.current_balance,
    t.event_date,
    t.debit_date
  FROM accounter_schema.transactions t
  JOIN accounter_schema.financial_accounts fa ON fa.id = t.account_id
  LEFT JOIN accounter_schema.transactions_raw_list rl ON rl.id = t.source_id
  LEFT JOIN accounter_schema.poalim_ils_account_transactions pi ON pi.id = rl.poalim_ils_id
  LEFT JOIN accounter_schema.poalim_foreign_account_transactions pf ON pf.id = rl.poalim_foreign_id
  WHERE fa.type = 'BANK_ACCOUNT'
    AND ($isAccountIds = 0 OR t.account_id IN $$accountIds)
    AND ($asOfDate ::TEXT IS NULL OR t.event_date <= $asOfDate ::DATE)
  ORDER BY
    t.account_id,
    t.currency,
    t.event_date DESC,
    COALESCE(pi.serial_number, pf.event_number) DESC NULLS LAST,
    t.created_at DESC;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class FinancialAccountsProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

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

  public async getLatestAccountBalances(params: {
    accountIds?: readonly string[] | null;
    asOfDate?: string | null;
  }) {
    const accountIds = params.accountIds?.length ? [...params.accountIds] : [null];
    const queryParams: IGetLatestAccountBalancesParams = {
      accountIds,
      isAccountIds: params.accountIds?.length ? 1 : 0,
      asOfDate: params.asOfDate ?? null,
    };
    return getLatestAccountBalances.run(queryParams, this.db);
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
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const bankAccountsWithOwnerId = params.bankAccounts.map(account =>
      reassureOwnerIdExists(account, ownerId),
    );
    return insertFinancialAccounts.run({ bankAccounts: bankAccountsWithOwnerId }, this.db);
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
