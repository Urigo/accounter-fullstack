import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetAllBankDepositsQuery,
  IGetAllBankDepositsResult,
  IGetAllOpenBankDepositsQuery,
  IGetAllOpenBankDepositsResult,
  IGetBankDepositsByIdsQuery,
  IInsertBankDepositParams,
  IInsertBankDepositQuery,
  IUpdateBankDepositParams,
  IUpdateBankDepositQuery,
} from '../types.js';

const getAllBankDeposits = sql<IGetAllBankDepositsQuery>`
  SELECT id, name, currency, account_id, open_date, close_date
  FROM accounter_schema.bank_deposits;`;

const getAllOpenBankDeposits = sql<IGetAllOpenBankDepositsQuery>`
  SELECT id, name, currency, account_id, open_date, close_date
  FROM accounter_schema.bank_deposits
  WHERE close_date IS NULL;`;

const getBankDepositsByIds = sql<IGetBankDepositsByIdsQuery>`
  SELECT id, name, currency, account_id, open_date, close_date
  FROM accounter_schema.bank_deposits
  WHERE id IN $$depositIds;`;

const insertBankDeposit = sql<IInsertBankDepositQuery>`
  INSERT INTO accounter_schema.bank_deposits (name, currency, account_id, open_date, close_date, owner_id)
  VALUES ($name, $currency, $accountId, $openDate, $closeDate, $ownerId)
  RETURNING id, name, currency, account_id, open_date, close_date;`;

const updateBankDeposit = sql<IUpdateBankDepositQuery>`
  UPDATE accounter_schema.bank_deposits
  SET name       = $name,
      currency   = COALESCE($currency, currency),
      open_date  = $openDate,
      close_date = $closeDate,
      account_id = $accountId
  WHERE id = $depositId
  RETURNING id, name, currency, account_id, open_date, close_date;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BankDepositsProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private allBankDepositsCache: Promise<IGetAllBankDepositsResult[]> | null = null;

  public getAllBankDeposits() {
    if (this.allBankDepositsCache) {
      return this.allBankDepositsCache;
    }
    this.allBankDepositsCache = getAllBankDeposits.run(undefined, this.db).then(deposits => {
      for (const deposit of deposits) {
        this.bankDepositByIdLoader.prime(deposit.id, deposit);
      }
      return deposits;
    });
    return this.allBankDepositsCache;
  }

  private allOpenBankDepositsCache: Promise<IGetAllOpenBankDepositsResult[]> | null = null;

  public getAllOpenBankDeposits() {
    if (this.allOpenBankDepositsCache) {
      return this.allOpenBankDepositsCache;
    }
    this.allOpenBankDepositsCache = getAllOpenBankDeposits
      .run(undefined, this.db)
      .then(deposits => {
        for (const deposit of deposits) {
          this.bankDepositByIdLoader.prime(deposit.id, deposit);
        }
        return deposits;
      });
    return this.allOpenBankDepositsCache;
  }

  private async batchBankDepositsByIds(depositIds: readonly string[]) {
    const deposits = await getBankDepositsByIds.run({ depositIds }, this.db);
    return depositIds.map(id => deposits.find(d => d.id === id) ?? null);
  }

  public bankDepositByIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchBankDepositsByIds(keys),
  );

  public async insertBankDeposit(params: IInsertBankDepositParams) {
    this.clearCache();
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const [result] = await insertBankDeposit.run(reassureOwnerIdExists(params, ownerId), this.db);
    if (result) {
      this.bankDepositByIdLoader.prime(result.id, result);
    }
    return result;
  }

  public async updateBankDeposit(params: IUpdateBankDepositParams) {
    const [result] = await updateBankDeposit.run(params, this.db);
    if (result) {
      this.bankDepositByIdLoader.clear(result.id).prime(result.id, result);
      this.allBankDepositsCache = null;
      this.allOpenBankDepositsCache = null;
    }
    return result ?? null;
  }

  public clearCache() {
    this.bankDepositByIdLoader.clearAll();
    this.allBankDepositsCache = null;
    this.allOpenBankDepositsCache = null;
  }
}
