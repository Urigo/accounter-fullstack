import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { Optional, TimelessDateString } from '@shared/types';
import type {
  IGetTransactionsByChargeIdsQuery,
  IGetTransactionsByChargeIdsResult,
  IGetTransactionsByFiltersParams,
  IGetTransactionsByFiltersQuery,
  IGetTransactionsByFiltersResult,
  IGetTransactionsByIdsQuery,
  IReplaceTransactionsChargeIdParams,
  IReplaceTransactionsChargeIdQuery,
  IUpdateTransactionParams,
  IUpdateTransactionQuery,
} from '../types.js';

export type TransactionRequiredWrapper<
  T extends {
    id: unknown;
    account_id: unknown;
    charge_id: unknown;
    source_id: unknown;
    currency: unknown;
    event_date: unknown;
    amount: unknown;
    current_balance: unknown;
  },
> = Omit<
  T,
  | 'id'
  | 'account_id'
  | 'charge_id'
  | 'source_id'
  | 'currency'
  | 'event_date'
  | 'amount'
  | 'current_balance'
> & {
  id: NonNullable<T['id']>;
  account_id: NonNullable<T['account_id']>;
  charge_id: NonNullable<T['charge_id']>;
  source_id: NonNullable<T['source_id']>;
  currency: NonNullable<T['currency']>;
  event_date: NonNullable<T['event_date']>;
  amount: NonNullable<T['amount']>;
  current_balance: NonNullable<T['current_balance']>;
};

const getTransactionsByIds = sql<IGetTransactionsByIdsQuery>`
    SELECT *
    FROM accounter_schema.extended_transactions
    WHERE id IN $$transactionIds;`;

const getTransactionsByChargeIds = sql<IGetTransactionsByChargeIdsQuery>`
    SELECT *
    FROM accounter_schema.extended_transactions
    WHERE charge_id IN $$chargeIds
    ORDER BY event_date DESC;`;

const replaceTransactionsChargeId = sql<IReplaceTransactionsChargeIdQuery>`
  UPDATE accounter_schema.transactions
  SET charge_id = $assertChargeID
  WHERE charge_id = $replaceChargeID
  RETURNING id;
`;

const updateTransaction = sql<IUpdateTransactionQuery>`
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
    )
  WHERE
    id = $transactionId
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

const getTransactionsByFilters = sql<IGetTransactionsByFiltersQuery>`
  SELECT t.*
  FROM accounter_schema.extended_transactions t
  WHERE
    ($isIDs = 0 OR t.id IN $$IDs)
    AND ($fromEventDate ::TEXT IS NULL OR t.event_date::TEXT::DATE >= date_trunc('day', $fromEventDate ::DATE))
    AND ($toEventDate ::TEXT IS NULL OR t.event_date::TEXT::DATE <= date_trunc('day', $toEventDate ::DATE))
    AND ($fromDebitDate ::TEXT IS NULL OR t.debit_date::TEXT::DATE >= date_trunc('day', $fromDebitDate ::DATE))
    AND ($toDebitDate ::TEXT IS NULL OR t.debit_date::TEXT::DATE <= date_trunc('day', $toDebitDate ::DATE))
    AND ($isBusinessIDs = 0 OR t.business_id IN $$businessIDs)
  ORDER BY event_date DESC;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchTransactionsByIds(ids: readonly string[]) {
    const transactions = await getTransactionsByIds.run(
      {
        transactionIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => transactions.find(charge => charge.id === id));
  }

  public getTransactionByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTransactionsByIds(keys),
    { cache: false },
  );

  private async batchTransactionsByChargeIDs(chargeIds: readonly string[]) {
    const transactions = await getTransactionsByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id =>
      (transactions as IGetTransactionsByChargeIdsResult[]).filter(
        transaction => transaction.charge_id === id,
      ),
    );
  }

  public getTransactionsByChargeIDLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTransactionsByChargeIDs(keys),
    {
      cache: false,
    },
  );

  public async replaceTransactionsChargeId(params: IReplaceTransactionsChargeIdParams) {
    return replaceTransactionsChargeId.run(params, this.dbProvider);
  }

  public updateTransaction(params: IUpdateTransactionParams) {
    return updateTransaction.run(params, this.dbProvider);
  }

  public getTransactionsByFilters(params: IGetAdjustedTransactionsByFiltersParams) {
    const isIDs = !!params?.IDs?.length;
    const isBusinessIDs = !!params?.businessIDs?.length;

    const fullParams: IGetTransactionsByFiltersParams = {
      isIDs: isIDs ? 1 : 0,
      isBusinessIDs: isBusinessIDs ? 1 : 0,
      fromEventDate: null,
      toEventDate: null,
      fromDebitDate: null,
      toDebitDate: null,
      ...params,
      IDs: isIDs ? params.IDs! : [null],
      businessIDs: isBusinessIDs ? params.businessIDs! : [null],
    };
    return getTransactionsByFilters.run(fullParams, this.dbProvider) as Promise<
      IGetTransactionsByFiltersResult[]
    >;
  }
}
