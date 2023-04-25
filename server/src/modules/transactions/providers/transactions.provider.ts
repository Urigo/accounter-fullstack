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

// const getChargesByFinancialEntityIds = sql<IGetChargesByFinancialEntityIdsQuery>`
//     SELECT at.*, fa.owner as owner_id
//     FROM accounter_schema.all_transactions at
//     LEFT JOIN accounter_schema.financial_accounts fa
//     ON  at.account_number = fa.account_number
//     WHERE fa.owner IN $$financialEntityIds
//     AND ($fromDate ::TEXT IS NULL OR at.event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
//     AND ($toDate ::TEXT IS NULL OR at.event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
//     ORDER BY at.event_date DESC;`;

// const getConversionOtherSide = sql<IGetConversionOtherSideQuery>`
//     SELECT event_amount, currency_code
//     FROM accounter_schema.all_transactions
//     WHERE bank_reference = $bankReference
//       AND id <> $chargeId
//       LIMIT 1;`;

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
    source_id = COALESCE(
      $sourceId,
      source_id,
      NULL
    ),
    source_description = COALESCE(
      $sourceDescription,
      source_description,
      NULL
    ),
    currency = COALESCE(
      $currency,
      currency,
      NULL
    ),
    event_date = COALESCE(
      $eventDate,
      event_date,
      NULL
    ),
    debit_date = COALESCE(
      $debitDate,
      debit_date,
      NULL
    ),
    amount = COALESCE(
      $Amount,
      amount,
      NULL
    ),
    current_balance = COALESCE(
      $currentBalance,
      current_balance,
      NULL
    )
  WHERE
    id = $transactionId
  RETURNING *;
`;

// const getChargesByFilters = sql<IGetChargesByFiltersQuery>`
//   SELECT
//     at.*,
//     ABS(cast(at.event_amount as DECIMAL)) as abs_event_amount,
//     bu.no_invoices_required,
//     -- invoices_count column, conditional calculation
//     CASE WHEN $preCountInvoices = false THEN NULL ELSE (
//       SELECT COUNT(*)
//       FROM accounter_schema.documents d
//       WHERE d.charge_id = at.id
//         AND d.type IN ('INVOICE', 'INVOICE_RECEIPT')
//     ) END as invoices_count,
//     -- receipts_count column, conditional calculation
//     CASE WHEN $preCountReceipts = false THEN NULL ELSE (
//       SELECT COUNT(*)
//       FROM accounter_schema.documents d
//       WHERE d.charge_id = at.id
//         AND d.type IN ('RECEIPT', 'INVOICE_RECEIPT')
//     ) END as receipts_count,
//     -- ledger_records_count column, conditional calculation
//     CASE WHEN $preCountLedger = false THEN NULL ELSE (
//       SELECT COUNT(*)
//       FROM accounter_schema.ledger l
//       WHERE l.original_id = at.id
//     ) END as ledger_records_count,
//     -- balance column, conditional calculation
//     CASE WHEN $preCalculateBalance = false THEN NULL ELSE (
//       SELECT SUM(lr.amount) as balance
//       FROM (
//         SELECT debit_account_id_1 AS business_id, (debit_amount_1::DECIMAL * -1) AS amount, to_date(invoice_date, 'DD/MM/YYYY') as date, business as financial_entity_id
//         FROM accounter_schema.ledger
//         WHERE debit_amount_1 IS NOT NULL
//         UNION ALL
//         SELECT debit_account_id_2, (debit_amount_2::DECIMAL * -1), to_date(invoice_date, 'DD/MM/YYYY'), business
//         FROM accounter_schema.ledger
//         WHERE debit_amount_2 IS NOT NULL
//         UNION ALL
//         SELECT credit_account_id_1, credit_amount_1::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
//         FROM accounter_schema.ledger
//         WHERE credit_amount_1 IS NOT NULL
//         UNION ALL
//         SELECT credit_account_id_2, credit_amount_2::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
//         FROM accounter_schema.ledger
//         WHERE credit_amount_2 IS NOT NULL
//       ) lr
//       WHERE lr.date <= (
//         SELECT MAX(to_date(l.invoice_date, 'DD/MM/YYYY'))
//         FROM accounter_schema.ledger l
//         WHERE l.original_id = at.id
//           AND lr.business_id = at.financial_entity_id
//           AND lr.financial_entity_id = fa.owner)
//     ) END as balance
//   FROM accounter_schema.all_transactions at
//   LEFT JOIN accounter_schema.financial_accounts fa
//   ON  at.account_number = fa.account_number
//   LEFT JOIN accounter_schema.businesses bu
//   ON  at.financial_entity_id = bu.id
//   WHERE
//   ($isIDs = 0 OR at.id IN $$IDs)
//   AND ($isFinancialEntityIds = 0 OR fa.owner IN $$financialEntityIds)
//   AND ($isBusinessesIDs = 0 OR at.financial_entity_id IN $$businessesIDs)
//   AND ($isNotBusinessesIDs = 0 OR at.financial_entity_id NOT IN $$notBusinessesIDs)
//   AND ($fromDate ::TEXT IS NULL OR at.event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
//   AND ($toDate ::TEXT IS NULL OR at.event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
//   AND ($chargeType = 'ALL' OR ($chargeType = 'INCOME' AND at.event_amount > 0) OR ($chargeType = 'EXPENSE' AND at.event_amount <= 0))
//   ORDER BY
//   CASE WHEN $asc = true AND $sortColumn = 'event_date' THEN at.event_date  END ASC,
//   CASE WHEN $asc = false AND $sortColumn = 'event_date'  THEN at.event_date  END DESC,
//   CASE WHEN $asc = true AND $sortColumn = 'event_amount' THEN at.event_amount  END ASC,
//   CASE WHEN $asc = false AND $sortColumn = 'event_amount'  THEN at.event_amount  END DESC,
//   CASE WHEN $asc = true AND $sortColumn = 'abs_event_amount' THEN ABS(cast(at.event_amount as DECIMAL))  END ASC,
//   CASE WHEN $asc = false AND $sortColumn = 'abs_event_amount'  THEN ABS(cast(at.event_amount as DECIMAL))  END DESC;
//   `;

// type IGetAdjustedChargesByFiltersParams = Optional<
//   Omit<
//     IGetChargesByFiltersParams,
//     'isBusinesses' | 'isFinancialEntityIds' | 'isIDs' | 'isNotBusinesses'
//   >,
//   | 'businessesIDs'
//   | 'financialEntityIds'
//   | 'IDs'
//   | 'notBusinessesIDs'
//   | 'asc'
//   | 'sortColumn'
//   | 'toDate'
//   | 'fromDate'
//   | 'preCalculateBalance'
//   | 'preCountInvoices'
//   | 'preCountLedger'
//   | 'preCountReceipts'
// > & {
//   toDate?: TimelessDateString | null;
//   fromDate?: TimelessDateString | null;
// };

// const validateCharges = sql<IValidateChargesQuery>`
//   SELECT
//     at.*,
//     (bu.country <> 'Israel') as is_foreign,
//     bu.no_invoices_required,
//     (
//       SELECT COUNT(*)
//       FROM accounter_schema.documents d
//       WHERE d.charge_id = at.id
//         AND d.type IN ('INVOICE', 'INVOICE_RECEIPT')
//     ) as invoices_count,
//     (
//       SELECT COUNT(*)
//       FROM accounter_schema.documents d
//       WHERE d.charge_id = at.id
//         AND d.type IN ('RECEIPT', 'INVOICE_RECEIPT')
//     ) as receipts_count,
//     (
//       SELECT COUNT(*)
//       FROM accounter_schema.ledger l
//       WHERE l.original_id = at.id
//     ) as ledger_records_count,
//     (
//       SELECT SUM(lr.amount) as balance
//       FROM (
//         SELECT debit_account_id_1 AS business_id, (debit_amount_1::DECIMAL * -1) AS amount, to_date(invoice_date, 'DD/MM/YYYY') as date, business as financial_entity_id
//         FROM accounter_schema.ledger
//         WHERE debit_amount_1 IS NOT NULL
//         UNION ALL
//         SELECT debit_account_id_2, (debit_amount_2::DECIMAL * -1), to_date(invoice_date, 'DD/MM/YYYY'), business
//         FROM accounter_schema.ledger
//         WHERE debit_amount_2 IS NOT NULL
//         UNION ALL
//         SELECT credit_account_id_1, credit_amount_1::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
//         FROM accounter_schema.ledger
//         WHERE credit_amount_1 IS NOT NULL
//         UNION ALL
//         SELECT credit_account_id_2, credit_amount_2::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
//         FROM accounter_schema.ledger
//         WHERE credit_amount_2 IS NOT NULL
//       ) lr
//       WHERE lr.date <= (
//         SELECT MAX(to_date(l.invoice_date, 'DD/MM/YYYY'))
//         FROM accounter_schema.ledger l
//         WHERE l.original_id = at.id
//           AND lr.business_id = at.financial_entity_id
//           AND lr.financial_entity_id = fa.owner)
//     ) as balance
//   FROM accounter_schema.all_transactions at
//   LEFT JOIN accounter_schema.financial_accounts fa
//   ON  at.account_number = fa.account_number
//   LEFT JOIN accounter_schema.businesses bu
//   ON  at.financial_entity_id = bu.id
//   WHERE ($isFinancialEntityIds = 0 OR fa.owner IN $$financialEntityIds)
//     AND ($chargeType = 'ALL' OR ($chargeType = 'INCOME' AND at.event_amount > 0) OR ($chargeType = 'EXPENSE' AND at.event_amount <= 0))
//     AND ($isIDs = 0 OR at.id IN $$IDs)
//     AND ($fromDate ::TEXT IS NULL OR at.event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
//     AND ($toDate ::TEXT IS NULL OR at.event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
//     ORDER BY at.event_date DESC;
// `;

// type IValidateChargesAdjustedParams = Optional<
//   Omit<IValidateChargesParams, 'isIDs' | 'isFinancialEntityIds'>,
//   'IDs' | 'toDate' | 'fromDate' | 'financialEntityIds'
// > & {
//   toDate?: TimelessDateString | null;
//   fromDate?: TimelessDateString | null;
// };

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

  // public getChargesByFinancialEntityIds(params: IGetChargesByFinancialEntityIdsParams) {
  //   return getChargesByFinancialEntityIds.run(params, this.dbProvider);
  // }

  // private async batchChargesByFinancialEntityIds(financialEntityIds: readonly string[]) {
  //   const charges = await getChargesByFinancialEntityIds.run(
  //     {
  //       financialEntityIds,
  //       fromDate: null,
  //       toDate: null,
  //     },
  //     this.dbProvider,
  //   );
  //   return financialEntityIds.map(id => charges.filter(charge => charge.owner_id === id));
  // }

  // public getChargeByFinancialEntityIdLoader = new DataLoader(
  //   (keys: readonly string[]) => this.batchChargesByFinancialEntityIds(keys),
  //   {
  //     cache: false,
  //   },
  // );

  // public getConversionOtherSide(params: IGetConversionOtherSideParams) {
  //   return getConversionOtherSide.run(params, this.dbProvider);
  // }

  public updateTransaction(params: IUpdateTransactionParams) {
    return updateTransaction.run(params, this.dbProvider);
  }

  // public getChargesByFilters(params: IGetAdjustedChargesByFiltersParams) {
  //   const isBusinessesIDs = !!params?.businessesIDs?.length;
  //   const isFinancialEntityIds = !!params?.financialEntityIds?.length;
  //   const isIDs = !!params?.IDs?.length;
  //   const isNotBusinessesIDs = !!params?.notBusinessesIDs?.length;

  //   const defaults = {
  //     asc: false,
  //     sortColumn: 'event_date',
  //   };

  //   const fullParams: IGetChargesByFiltersParams = {
  //     ...defaults,
  //     isBusinessesIDs: isBusinessesIDs ? 1 : 0,
  //     isFinancialEntityIds: isFinancialEntityIds ? 1 : 0,
  //     isIDs: isIDs ? 1 : 0,
  //     isNotBusinessesIDs: isNotBusinessesIDs ? 1 : 0,
  //     ...params,
  //     preCalculateBalance: params.preCalculateBalance ?? false,
  //     preCountInvoices: params.preCountInvoices ?? false,
  //     preCountLedger: params.preCountLedger ?? false,
  //     preCountReceipts: params.preCountReceipts ?? false,
  //     fromDate: params.fromDate ?? null,
  //     toDate: params.toDate ?? null,
  //     businessesIDs: isBusinessesIDs ? params.businessesIDs! : [null],
  //     financialEntityIds: isFinancialEntityIds ? params.financialEntityIds! : [null],
  //     IDs: isIDs ? params.IDs! : [null],
  //     notBusinessesIDs: isNotBusinessesIDs ? params.notBusinessesIDs! : [null],
  //     chargeType: params.chargeType ?? 'ALL',
  //   };
  //   return getChargesByFilters.run(fullParams, this.dbProvider);
  // }

  // public validateCharges(params: IValidateChargesAdjustedParams) {
  //   const isIDs = !!params?.IDs?.length;
  //   const isFinancialEntityIds = !!params?.financialEntityIds?.length;

  //   const fullParams: IValidateChargesParams = {
  //     isIDs: isIDs ? 1 : 0,
  //     isFinancialEntityIds: isFinancialEntityIds ? 1 : 0,
  //     ...params,
  //     fromDate: params.fromDate ?? null,
  //     toDate: params.toDate ?? null,
  //     IDs: isIDs ? params.IDs! : [null],
  //     financialEntityIds: isFinancialEntityIds ? params.financialEntityIds! : [null],
  //     chargeType: params.chargeType ?? 'ALL',
  //   };
  //   return validateCharges.run(fullParams, this.dbProvider);
  // }

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
