import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { Optional, TimelessDateString } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetSimilarTransactionsParams,
  IGetSimilarTransactionsQuery,
  IGetTransactionsByChargeIdsQuery,
  IGetTransactionsByExtendedFiltersParams,
  IGetTransactionsByExtendedFiltersQuery,
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
  SELECT *
  FROM accounter_schema.transactions
  WHERE
    ($isIDs = 0 OR id IN $$IDs)
    AND ($fromEventDate ::TEXT IS NULL OR event_date >= $fromEventDate ::DATE)
    AND ($toEventDate ::TEXT IS NULL OR event_date <= $toEventDate ::DATE)
    AND ($fromDebitDate ::TEXT IS NULL OR COALESCE(debit_date_override, debit_date) >= $fromDebitDate ::DATE)
    AND ($toDebitDate ::TEXT IS NULL OR COALESCE(debit_date_override, debit_date) <= $toDebitDate ::DATE)
    AND ($isBusinessIDs = 0 OR business_id IN $$businessIDs)
    AND ($isOwnerIDs = 0 OR owner_id IN $$ownerIDs)
  ORDER BY event_date DESC;
`;

const getTransactionsByExtendedFilters = sql<IGetTransactionsByExtendedFiltersQuery>`
  SELECT t.*
  FROM accounter_schema.transactions t
  LEFT JOIN accounter_schema.financial_entities fe ON fe.id = t.business_id
  WHERE
    ($isIDs = 0 OR t.id IN $$IDs)
    AND ($isChargeIDs = 0 OR t.charge_id IN $$chargeIDs)
    AND ($isOwnerIDs = 0 OR t.owner_id IN $$ownerIDs)
    AND ($isCounterpartyIDs = 0 OR t.business_id IN $$counterpartyIDs)
    AND ($fromEventDate ::TEXT IS NULL OR t.event_date >= $fromEventDate ::DATE)
    AND ($toEventDate ::TEXT IS NULL OR t.event_date <= $toEventDate ::DATE)
    AND ($fromDebitDate ::TEXT IS NULL OR COALESCE(t.debit_date_override, t.debit_date) >= $fromDebitDate ::DATE)
    AND ($toDebitDate ::TEXT IS NULL OR COALESCE(t.debit_date_override, t.debit_date) <= $toDebitDate ::DATE)
    -- "any date" matches when a single date (event OR debit) falls within the requested range,
    -- so a transaction whose event date precedes the range and debit date follows it is excluded.
    AND (
      ($fromAnyDate ::TEXT IS NULL AND $toAnyDate ::TEXT IS NULL)
      OR (
        t.event_date IS NOT NULL
        AND ($fromAnyDate ::TEXT IS NULL OR t.event_date >= $fromAnyDate ::DATE)
        AND ($toAnyDate ::TEXT IS NULL OR t.event_date <= $toAnyDate ::DATE)
      )
      OR (
        COALESCE(t.debit_date_override, t.debit_date) IS NOT NULL
        AND ($fromAnyDate ::TEXT IS NULL OR COALESCE(t.debit_date_override, t.debit_date) >= $fromAnyDate ::DATE)
        AND ($toAnyDate ::TEXT IS NULL OR COALESCE(t.debit_date_override, t.debit_date) <= $toAnyDate ::DATE)
      )
    )
    AND ($withMissingCounterparty = FALSE OR t.business_id IS NULL)
    AND ($withMissingInfo = FALSE OR t.business_id IS NULL OR (t.debit_date IS NULL AND t.debit_date_override IS NULL))
    AND (
      $freeText ::TEXT IS NULL
      OR t.source_description ILIKE '%' || $freeText || '%'
      OR t.source_reference ILIKE '%' || $freeText || '%'
      OR t.counter_account ILIKE '%' || $freeText || '%'
      OR t.origin_key ILIKE '%' || $freeText || '%'
      OR fe.name ILIKE '%' || $freeText || '%'
      -- match transaction amount. $freeTextNumeric has thousands separators stripped
      -- so both "1,234.56" and "1234.56" match the plain value stored in the DB.
      OR ($freeTextNumeric ::TEXT IS NOT NULL
          AND (t.amount::TEXT ILIKE '%' || $freeTextNumeric || '%'
               OR ABS(t.amount)::TEXT ILIKE '%' || $freeTextNumeric || '%'))
    )
  ORDER BY t.event_date DESC;
`;

const getSimilarTransactions = sql<IGetSimilarTransactionsQuery>`
    SELECT *
    FROM accounter_schema.transactions
    WHERE (CASE WHEN $withMissingInfo IS TRUE THEN
      business_id IS NULL
   ELSE
      TRUE
   END)
      AND (
        (source_description IS NOT NULL AND source_description <> '' AND source_description = $details)
        OR (counter_account IS NOT NULL AND counter_account <> '' AND counter_account = $counterAccount)
      ) AND owner_id = $ownerId;`;

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

type IGetAdjustedTransactionsByExtendedFiltersParams = Optional<
  Omit<
    IGetTransactionsByExtendedFiltersParams,
    | 'isIDs'
    | 'isChargeIDs'
    | 'isOwnerIDs'
    | 'isCounterpartyIDs'
    | 'fromEventDate'
    | 'toEventDate'
    | 'fromDebitDate'
    | 'toDebitDate'
    | 'fromAnyDate'
    | 'toAnyDate'
    | 'freeTextNumeric'
    | 'withMissingCounterparty'
    | 'withMissingInfo'
  >,
  'IDs' | 'chargeIDs' | 'ownerIDs' | 'counterpartyIDs' | 'freeText'
> & {
  fromEventDate?: TimelessDateString | null;
  toEventDate?: TimelessDateString | null;
  fromDebitDate?: TimelessDateString | null;
  toDebitDate?: TimelessDateString | null;
  fromAnyDate?: TimelessDateString | null;
  toAnyDate?: TimelessDateString | null;
  withMissingCounterparty?: boolean | null;
  withMissingInfo?: boolean | null;
};

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class TransactionsProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchTransactionsByIds(ids: readonly string[]) {
    const transactionIds = Array.from(new Set(ids));
    const transactions = await getTransactionsByIds.run(
      {
        transactionIds,
      },
      this.db,
    );
    return ids.map(id => {
      const transaction = transactions.find(transaction => transaction.id === id);
      if (!transaction) {
        return new Error(`Transaction ID="${id}" not found`);
      }
      return transaction;
    });
  }

  public transactionByIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchTransactionsByIds(keys),
  );

  public async getTransactionsByMissingRequiredInfo() {
    return getTransactionsByMissingRequiredInfo.run(undefined, this.db).then(res =>
      res.map(t => {
        this.transactionByIdLoader.prime(t.id, t);
        return t;
      }),
    );
  }

  private async batchTransactionsByChargeIDs(chargeIds: readonly string[]) {
    const transactions = await getTransactionsByChargeIds.run(
      {
        chargeIds,
      },
      this.db,
    );
    transactions.map(t => {
      this.transactionByIdLoader.prime(t.id, t);
    });
    return chargeIds.map(id => transactions.filter(transaction => transaction.charge_id === id));
  }

  public transactionsByChargeIDLoader = new DataLoader((keys: readonly string[]) =>
    this.batchTransactionsByChargeIDs(keys),
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
    return getTransactionsByFilters.run(fullParams, this.db);
  }

  public getTransactionsByExtendedFilters(params: IGetAdjustedTransactionsByExtendedFiltersParams) {
    const isIDs = !!params?.IDs?.length;
    const isChargeIDs = !!params?.chargeIDs?.length;
    const isOwnerIDs = !!params?.ownerIDs?.length;
    const isCounterpartyIDs = !!params?.counterpartyIDs?.length;

    const fullParams: IGetTransactionsByExtendedFiltersParams = {
      fromEventDate: null,
      toEventDate: null,
      fromDebitDate: null,
      toDebitDate: null,
      fromAnyDate: null,
      toAnyDate: null,
      ...params,
      isIDs: isIDs ? 1 : 0,
      isChargeIDs: isChargeIDs ? 1 : 0,
      isOwnerIDs: isOwnerIDs ? 1 : 0,
      isCounterpartyIDs: isCounterpartyIDs ? 1 : 0,
      IDs: isIDs ? params.IDs! : [null],
      chargeIDs: isChargeIDs ? params.chargeIDs! : [null],
      ownerIDs: isOwnerIDs ? params.ownerIDs! : [null],
      counterpartyIDs: isCounterpartyIDs ? params.counterpartyIDs! : [null],
      withMissingCounterparty: params.withMissingCounterparty ?? false,
      withMissingInfo: params.withMissingInfo ?? false,
      freeText: params.freeText ?? null,
      // strip thousands separators so amount searches match the plain value stored in the DB
      freeTextNumeric: params.freeText ? params.freeText.replaceAll(',', '') : null,
    };
    return getTransactionsByExtendedFilters.run(fullParams, this.db).then(res =>
      res.map(t => {
        this.transactionByIdLoader.prime(t.id, t);
        return t;
      }),
    );
  }

  public async getSimilarTransactions(params: IGetSimilarTransactionsParams) {
    try {
      return getSimilarTransactions.run(params, this.db);
    } catch (error) {
      const message = 'Failed to fetch similar transactions';
      console.error(message, error);
      throw new Error(message, { cause: error });
    }
  }

  public async replaceTransactionsChargeId(params: IReplaceTransactionsChargeIdParams) {
    if (params.replaceChargeID) {
      await this.invalidateTransactionByChargeID(params.replaceChargeID);
    }
    if (params.assertChargeID) {
      await this.invalidateTransactionByChargeID(params.assertChargeID);
    }
    return replaceTransactionsChargeId.run(params, this.db);
  }

  public async updateTransactions(params: IUpdateTransactionsParams) {
    if (params.transactionIds) {
      await Promise.all(
        params.transactionIds.map(async id => {
          if (id) {
            await this.invalidateTransactionByID(id);
          }
        }),
      );
    }
    return updateTransactions.run(params, this.db);
  }

  public async invalidateTransactionByChargeID(chargeId: string) {
    this.transactionsByChargeIDLoader.clear(chargeId);
    try {
      const transactions = await getTransactionsByChargeIds.run(
        {
          chargeIds: [chargeId],
        },
        this.db,
      );
      transactions.map(t => this.transactionByIdLoader.clear(t.id));
    } catch (e) {
      console.error(`Error invalidating transaction by charge ID "${chargeId}":`, e);
    }
  }

  public async invalidateTransactionByID(id: string) {
    this.transactionByIdLoader.clear(id);
    try {
      const [transaction] = await getTransactionsByIds.run(
        {
          transactionIds: [id],
        },
        this.db,
      );
      if (transaction?.charge_id) {
        this.transactionsByChargeIDLoader.clear(transaction.charge_id);
      }
    } catch (e) {
      console.error(`Error invalidating transaction by ID "${id}":`, e);
    }
  }

  public clearCache() {
    this.transactionByIdLoader.clearAll();
    this.transactionsByChargeIDLoader.clearAll();
  }
}
