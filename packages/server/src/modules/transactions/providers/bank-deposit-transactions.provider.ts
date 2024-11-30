import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IAddBankDepositTransactionParams,
  IAddBankDepositTransactionQuery,
  IDeleteBankDepositTransactionsByIdsParams,
  IDeleteBankDepositTransactionsByIdsQuery,
  IGetBankDepositTransactionsByIdsQuery,
  IGetDepositTransactionsByChargeIdQuery,
  IGetDepositTransactionsByChargeIdResult,
  IGetDepositTransactionsByTransactionIdQuery,
  IGetTransactionsByBankDepositsQuery,
  IUpdateBankDepositTransactionParams,
  IUpdateBankDepositTransactionQuery,
} from '../types.js';

const getBankDepositTransactionsByIds = sql<IGetBankDepositTransactionsByIdsQuery>`
    SELECT *
    FROM accounter_schema.transactions_bank_deposits
    WHERE id IN $$transactionIds;`;

const getTransactionsByBankDeposits = sql<IGetTransactionsByBankDepositsQuery>`
    SELECT *
    FROM accounter_schema.transactions_bank_deposits
    LEFT JOIN accounter_schema.transactions
      USING (id)
    WHERE deposit_id IN $$depositIds;`;

const getDepositTransactionsByTransactionId = sql<IGetDepositTransactionsByTransactionIdQuery>`
    SELECT *
    FROM accounter_schema.transactions_bank_deposits
    LEFT JOIN accounter_schema.transactions
      USING (id)
    WHERE deposit_id IN (
      SELECT deposit_id
      FROM accounter_schema.transactions_bank_deposits
      WHERE id = $transactionId
    );`;

const getDepositTransactionsByChargeId = sql<IGetDepositTransactionsByChargeIdQuery>`
    SELECT *
    FROM accounter_schema.transactions_bank_deposits
    LEFT JOIN accounter_schema.transactions
      USING (id)
    WHERE deposit_id IN (
      SELECT deposit_id
      FROM accounter_schema.transactions_bank_deposits
      LEFT JOIN accounter_schema.transactions
        USING (id)
      WHERE charge_id = $chargeId
    )
    AND charge_id <> $chargeId;`;

const updateBankDepositTransaction = sql<IUpdateBankDepositTransactionQuery>`
  UPDATE accounter_schema.transactions_bank_deposits
  SET
    deposit_id = COALESCE(
      $depositId,
      deposit_id,
      NULL
    )
  WHERE
    id = $transactionId
  RETURNING *;
`;

const addBankDepositTransaction = sql<IAddBankDepositTransactionQuery>`
  INSERT INTO accounter_schema.transactions_bank_deposits (id, deposit_id)
  VALUES $$bankDepositTransactions(id, depositId)
  ON CONFLICT DO NOTHING
  RETURNING *;`;

const deleteBankDepositTransactionsByIds = sql<IDeleteBankDepositTransactionsByIdsQuery>`
    DELETE FROM accounter_schema.transactions_bank_deposits
    WHERE id IN $$transactionIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BankDepositTransactionsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchBankDepositTransactionsByIds(ids: readonly string[]) {
    const transactions = await getBankDepositTransactionsByIds.run(
      {
        transactionIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => transactions.find(t => t.id === id));
  }

  public getBankDepositTransactionByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchBankDepositTransactionsByIds(keys),
    {
      cacheKeyFn: key => `bank-deposit-transaction-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchTransactionsByBankDeposits(depositIds: readonly string[]) {
    const transactions = await getTransactionsByBankDeposits.run(
      {
        depositIds,
      },
      this.dbProvider,
    );
    return depositIds.map(id => transactions.filter(t => t.deposit_id === id));
  }

  public getTransactionsByBankDepositLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTransactionsByBankDeposits(keys),
    {
      cacheKeyFn: key => `bank-deposit-${key}`,
      cacheMap: this.cache,
    },
  );

  public getDepositTransactionsByTransactionId(transactionId: string) {
    const cacheKey = `deposit-transactions-by-transaction-${transactionId}`;
    if (this.cache.get(cacheKey)) return this.cache.get(cacheKey);
    return getDepositTransactionsByTransactionId
      .run({ transactionId }, this.dbProvider)
      .then(res => {
        this.cache.set(cacheKey, res);
        return res;
      });
  }

  public getDepositTransactionsByChargeId(chargeId: string) {
    const cacheKey = `deposit-transactions-by-charge-${chargeId}`;
    if (this.cache.get(cacheKey))
      return this.cache.get(cacheKey) as IGetDepositTransactionsByChargeIdResult[];
    return getDepositTransactionsByChargeId.run({ chargeId }, this.dbProvider).then(res => {
      this.cache.set(cacheKey, res);
      return res;
    });
  }

  public updateBankDepositTransaction(params: IUpdateBankDepositTransactionParams) {
    this.clearCache();
    return updateBankDepositTransaction.run(params, this.dbProvider);
  }

  public addBankDepositTransaction(params: IAddBankDepositTransactionParams) {
    this.clearCache();
    return addBankDepositTransaction.run(params, this.dbProvider);
  }

  public deleteBankDepositTransactionsByIds(params: IDeleteBankDepositTransactionsByIdsParams) {
    this.clearCache();
    return deleteBankDepositTransactionsByIds.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
