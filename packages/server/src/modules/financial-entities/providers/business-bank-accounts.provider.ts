import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteBusinessBankAccountsQuery,
  IGetBusinessBankAccountsByBusinessIdsQuery,
  IGetBusinessBankAccountsByBusinessIdsResult,
  IInsertBusinessBankAccountsParams,
  IInsertBusinessBankAccountsQuery,
} from '../types.js';

const getBusinessBankAccountsByBusinessIds = sql<IGetBusinessBankAccountsByBusinessIdsQuery>`
  SELECT id, business_id, owner_id, bank_number, branch_number, account_number
  FROM accounter_schema.businesses_bank_accounts
  WHERE business_id = ANY($businessIds)
  ORDER BY created_at ASC;`;

const insertBusinessBankAccounts = sql<IInsertBusinessBankAccountsQuery>`
  INSERT INTO accounter_schema.businesses_bank_accounts (business_id, owner_id, bank_number, branch_number, account_number)
  VALUES $$accounts(businessId, ownerId, bankNumber, branchNumber, accountNumber)
  RETURNING id, business_id, owner_id, bank_number, branch_number, account_number;`;

const deleteBusinessBankAccounts = sql<IDeleteBusinessBankAccountsQuery>`
  DELETE FROM accounter_schema.businesses_bank_accounts
  WHERE business_id = $businessId
  RETURNING id;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessBankAccountsProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchBankAccountsByBusinessIds(businessIds: readonly string[]) {
    const uniqueIds = [...new Set(businessIds)];
    const accounts = await getBusinessBankAccountsByBusinessIds.run(
      { businessIds: uniqueIds },
      this.db,
    );
    return businessIds.map(id =>
      accounts.filter(account => account.business_id === id).map(toGraphQL),
    );
  }

  public getBankAccountsByBusinessIdLoader = new DataLoader(
    (businessIds: readonly string[]) => this.batchBankAccountsByBusinessIds(businessIds),
    { cache: false },
  );

  /**
   * Replace the full set of bank accounts for a business with the provided list (delete-then-insert).
   * An empty list clears the business' bank accounts.
   */
  public async setBankAccountsForBusiness(
    businessId: string,
    ownerId: string,
    accounts: ReadonlyArray<{ bankNumber: number; branchNumber: number; accountNumber: number }>,
  ) {
    this.getBankAccountsByBusinessIdLoader.clear(businessId);
    await deleteBusinessBankAccounts.run({ businessId }, this.db);
    if (accounts.length === 0) {
      return [];
    }
    const params: IInsertBusinessBankAccountsParams['accounts'] = accounts.map(account => ({
      businessId,
      ownerId,
      bankNumber: account.bankNumber,
      branchNumber: account.branchNumber,
      accountNumber: account.accountNumber,
    }));
    const inserted = await insertBusinessBankAccounts.run({ accounts: params }, this.db);
    return inserted.map(toGraphQL);
  }
}

function toGraphQL(row: IGetBusinessBankAccountsByBusinessIdsResult) {
  return {
    id: row.id,
    bankNumber: row.bank_number,
    branchNumber: row.branch_number,
    accountNumber: row.account_number,
  };
}
