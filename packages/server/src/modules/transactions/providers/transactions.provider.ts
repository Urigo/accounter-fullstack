import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import { Optional, TimelessDateString } from '@shared/types';
import type {
  IGetSimilarTransactionsParams,
  IGetSimilarTransactionsQuery,
  IGetTransactionsByChargeIdsQuery,
  IGetTransactionsByFiltersParams,
  IGetTransactionsByFiltersQuery,
  IGetTransactionsByIdsQuery,
  IGetTransactionsByMissingRequiredInfoQuery,
  IReplaceTransactionsChargeIdParams,
  IReplaceTransactionsChargeIdQuery,
  IUpdateTransactionsParams,
  IUpdateTransactionsQuery,
} from '../types.js';

const getTransactionsByIds = sql<IGetTransactionsByIdsQuery>`
    SELECT *
    FROM accounter_schema.transactions
    WHERE id IN $$transactionIds;`;

const getTransactionsByChargeIds = sql<IGetTransactionsByChargeIdsQuery>`
    SELECT *
    FROM accounter_schema.transactions
    WHERE charge_id IN $$chargeIds;`;

const getTransactionsByMissingRequiredInfo = sql<IGetTransactionsByMissingRequiredInfoQuery>`
    SELECT *
    FROM accounter_schema.transactions
    WHERE business_id IS NULL;`;

const getTransactionsByFilters = sql<IGetTransactionsByFiltersQuery>`
  SELECT t.*
  FROM accounter_schema.transactions t
  LEFT JOIN accounter_schema.charges c
    ON t.charge_id = C.id
  WHERE
    ($isIDs = 0 OR t.id IN $$IDs)
    AND ($fromEventDate ::TEXT IS NULL OR t.event_date::TEXT::DATE >= date_trunc('day', $fromEventDate ::DATE))
    AND ($toEventDate ::TEXT IS NULL OR t.event_date::TEXT::DATE <= date_trunc('day', $toEventDate ::DATE))
    AND ($fromDebitDate ::TEXT IS NULL OR COALESCE(t.debit_date_override, t.debit_date)::TEXT::DATE >= date_trunc('day', $fromDebitDate ::DATE))
    AND ($toDebitDate ::TEXT IS NULL OR COALESCE(t.debit_date_override, t.debit_date)::TEXT::DATE <= date_trunc('day', $toDebitDate ::DATE))
    AND ($isBusinessIDs = 0 OR t.business_id IN $$businessIDs)
    AND ($isOwnerIDs = 0 OR c.owner_id IN $$ownerIDs)
  ORDER BY event_date DESC;
`;

const getSimilarTransactions = sql<IGetSimilarTransactionsQuery>`
    SELECT t.*, c.owner_id
    FROM accounter_schema.transactions t
    LEFT JOIN accounter_schema.charges c
      ON t.charge_id = c.id
    WHERE (CASE WHEN $withMissingInfo IS TRUE THEN
      business_id IS NULL
   ELSE
      TRUE
   END)
      AND (
        (source_description IS NOT NULL AND source_description <> '' AND source_description = $details)
        OR (counter_account IS NOT NULL AND counter_account <> '' AND counter_account = $counterAccount)
      ) AND c.owner_id = $ownerId;`;

const replaceTransactionsChargeId = sql<IReplaceTransactionsChargeIdQuery>`
  UPDATE accounter_schema.transactions
  SET charge_id = $assertChargeID
  WHERE charge_id = $replaceChargeID
  RETURNING id;
`;

const updateTransactions = sql<IUpdateTransactionsQuery>`
  UPDATE accounter_schema.transactions
  SET
    account_id = COALESCE(
      $accountId,
      account_id,
      NULL
    ),
    charge_id = COALESCE(
      $chargeId,
      charge_id,
      NULL
    ),
    debit_date_override = COALESCE(
      $debitDate,
      debit_date_override,
      NULL
    ),
    business_id = COALESCE(
      $businessId,
      business_id,
      NULL
    ),
    is_fee = COALESCE(
      $isFee,
      is_fee,
      NULL
    )
  WHERE
    id IN $$transactionIds
  RETURNING *;
`;

type IGetAdjustedTransactionsByFiltersParams = Optional<
  Omit<
    IGetTransactionsByFiltersParams,
    'isIDs' | 'fromEventDate' | 'toEventDate' | 'fromDebitDate' | 'toDebitDate'
  >,
  'IDs' | 'businessIDs'
> & {
  fromEventDate?: TimelessDateString | null;
  toEventDate?: TimelessDateString | null;
  fromDebitDate?: TimelessDateString | null;
  toDebitDate?: TimelessDateString | null;
};

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TransactionsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchTransactionsByIds(ids: readonly string[]) {
    const transactions = await getTransactionsByIds.run(
      {
        transactionIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => {
      const transaction = transactions.find(transaction => transaction.id === id);
      if (!transaction) {
        return new Error(`Transaction ID="${id}" not found`);
      }
      return transaction;
    });
  }

  public transactionByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTransactionsByIds(keys),
    {
      cacheKeyFn: id => `transaction-${id}`,
      cacheMap: this.cache,
    },
  );

  public async getTransactionsByMissingRequiredInfo() {
    return getTransactionsByMissingRequiredInfo.run(undefined, this.dbProvider).then(res =>
      res.map(t => {
        this.cache.set(`transaction-${t.id}`, t);
        return t;
      }),
    );
  }

  private async batchTransactionsByChargeIDs(chargeIds: readonly string[]) {
    const transactions = await getTransactionsByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    transactions.map(t => {
      this.cache.set(`transaction-${t.id}`, t);
    });
    return chargeIds.map(id => transactions.filter(transaction => transaction.charge_id === id));
  }

  public transactionsByChargeIDLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTransactionsByChargeIDs(keys),
    {
      cacheKeyFn: id => `transactions-by-charge-${id}`,
      cacheMap: this.cache,
    },
  );

  public getTransactionsByFilters(params: IGetAdjustedTransactionsByFiltersParams) {
    const isIDs = !!params?.IDs?.length;
    const isBusinessIDs = !!params?.businessIDs?.length;
    const isOwnerIDs = !!params?.ownerIDs?.length;

    const fullParams: IGetTransactionsByFiltersParams = {
      isIDs: isIDs ? 1 : 0,
      isBusinessIDs: isBusinessIDs ? 1 : 0,
      isOwnerIDs: isOwnerIDs ? 1 : 0,
      fromEventDate: null,
      toEventDate: null,
      fromDebitDate: null,
      toDebitDate: null,
      ...params,
      IDs: isIDs ? params.IDs! : [null],
      businessIDs: isBusinessIDs ? params.businessIDs! : [null],
      ownerIDs: isOwnerIDs ? params.ownerIDs! : [null],
    };
    return getTransactionsByFilters.run(fullParams, this.dbProvider);
  }

  public async getSimilarTransactions(params: IGetSimilarTransactionsParams) {
    try {
      return getSimilarTransactions.run(params, this.dbProvider);
    } catch (error) {
      const message = 'Failed to fetch similar transactions';
      console.error(message, error);
      throw new Error(message);
    }
  }

  public async replaceTransactionsChargeId(params: IReplaceTransactionsChargeIdParams) {
    if (params.replaceChargeID) {
      await this.invalidateTransactionByChargeID(params.replaceChargeID);
    }
    if (params.assertChargeID) {
      await this.invalidateTransactionByChargeID(params.assertChargeID);
    }
    return replaceTransactionsChargeId.run(params, this.dbProvider);
  }

  public async updateTransactions(params: IUpdateTransactionsParams) {
    if (params.transactionIds) {
      Promise.all(
        params.transactionIds.map(async id => {
          if (id) {
            await this.invalidateTransactionByID(id);
          }
        }),
      );
    }
    return updateTransactions.run(params, this.dbProvider);
  }

  public async invalidateTransactionByChargeID(chargeId: string) {
    try {
      const transactions = await getTransactionsByChargeIds.run(
        {
          chargeIds: [chargeId],
        },
        this.dbProvider,
      );
      transactions.map(transaction => this.cache.delete(`transaction-${transaction.id}`));
      this.cache.delete(`transactions-by-charge-${chargeId}`);
    } catch (e) {
      console.error(`Error invalidating transaction by charge ID "${chargeId}":`, e);
    }
  }

  public async invalidateTransactionByID(id: string) {
    try {
      const [transaction] = await getTransactionsByIds.run(
        {
          transactionIds: [id],
        },
        this.dbProvider,
      );
      if (transaction) {
        this.cache.delete(`transactions-by-charge-${transaction.charge_id}`);
      }
      this.cache.delete(`transaction-${id}`);
    } catch (e) {
      console.error(`Error invalidating transaction by ID "${id}":`, e);
    }
  }

  public clearCache() {
    this.cache.clear();
  }
}
