import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type { Optional, TimelessDateString } from '@shared/types';
import { validateCharge } from '../helpers/validate.helper.js';
import type {
  ChargesModule,
  IDeleteChargesByIdsParams,
  IDeleteChargesByIdsQuery,
  IGetChargesByFiltersParams,
  IGetChargesByFiltersQuery,
  IGetChargesByFiltersResult,
  IGetChargesByFinancialAccountIdsParams,
  IGetChargesByFinancialAccountIdsQuery,
  IGetChargesByFinancialAccountIdsResult,
  IGetChargesByFinancialEntityIdsParams,
  IGetChargesByFinancialEntityIdsQuery,
  IGetChargesByFinancialEntityIdsResult,
  IGetChargesByIdsQuery,
  IGetChargesByIdsResult, // IGetConversionOtherSideParams,
  // IGetConversionOtherSideQuery,
  IUpdateChargeParams,
  IUpdateChargeQuery,
  IUpdateChargeResult,
  IValidateChargesParams,
  IValidateChargesQuery,
  IValidateChargesResult,
} from '../types.js';

export type ChargeRequiredWrapper<
  T extends {
    id: unknown;
    owner_id: unknown;
    is_conversion: unknown;
    is_property: unknown;
    accountant_reviewed: unknown;
  },
> = Omit<T, 'id' | 'owner_id' | 'is_conversion' | 'is_property' | 'accountant_reviewed'> & {
  id: NonNullable<T['id']>;
  owner_id: NonNullable<T['owner_id']>;
  is_conversion: NonNullable<T['is_conversion']>;
  is_property: NonNullable<T['is_property']>;
  accountant_reviewed: NonNullable<T['accountant_reviewed']>;
};

const getChargesByIds = sql<IGetChargesByIdsQuery>`
    SELECT *
    FROM accounter_schema.extended_charges
    WHERE id IN $$chargeIds;`;

const getChargesByFinancialAccountIds = sql<IGetChargesByFinancialAccountIdsQuery>`
    SELECT c.*, t.account_id
    FROM accounter_schema.extended_charges c
    LEFT JOIN accounter_schema.transactions t
    ON c.id = t.charge_id
    WHERE c.id IN (
      SELECT charge_id
      FROM accounter_schema.transactions
      WHERE account_id IN $$financialAccountIDs
      AND ($fromDate ::TEXT IS NULL OR event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
      AND ($toDate ::TEXT IS NULL OR event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    )
    AND t.event_date = (
      SELECT MIN(event_date)
      FROM accounter_schema.transactions as t2
      WHERE t2.charge_id = c.id
    )
    ORDER BY t.event_date DESC;`;

const getChargesByFinancialEntityIds = sql<IGetChargesByFinancialEntityIdsQuery>`
    SELECT c.*
    FROM accounter_schema.extended_charges c
    LEFT JOIN accounter_schema.transactions t
    ON c.id = t.charge_id
    WHERE owner_id IN $$financialEntityIds
    AND t.event_date = (
      SELECT MIN(event_date)
      FROM accounter_schema.transactions as t2
      WHERE t2.charge_id = c.id
    )
    AND ($fromDate ::TEXT IS NULL OR t.event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR t.event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY t.event_date DESC;`;

// const getConversionOtherSide = sql<IGetConversionOtherSideQuery>`
//     SELECT event_amount, currency_code
//     FROM accounter_schema.all_transactions
//     WHERE bank_reference = $bankReference
//       AND id <> $chargeId
//       LIMIT 1;`;

const updateCharge = sql<IUpdateChargeQuery>`
  UPDATE accounter_schema.charges
  SET
  owner_id = COALESCE(
    $ownerId,
    owner_id,
    NULL
  ),
  counterparty_id = COALESCE(
    $counterpartyId,
    counterparty_id,
    NULL
  ),
  user_description = COALESCE(
    $userDescription,
    user_description,
    NULL
  ),
  is_conversion = COALESCE(
    $isConversion,
    is_conversion,
    NULL
  ),
  is_property = COALESCE(
    $isProperty,
    is_property,
    NULL
  ),
  accountant_reviewed = COALESCE(
    $accountantReviewed,
    accountant_reviewed,
    NULL
  )
  WHERE
    id = $chargeId
  RETURNING *;
`;

const getChargesByFilters = sql<IGetChargesByFiltersQuery>`
  SELECT
    c.*,
    ABS(c.event_amount) as abs_event_amount,
    -- invoices_count column, conditional calculation
    CASE WHEN $preCountInvoices = false THEN NULL ELSE (
      SELECT COUNT(*)
      FROM accounter_schema.documents d
      WHERE d.charge_id = c.id
        AND d.type IN ('INVOICE', 'INVOICE_RECEIPT')
    ) END as invoices_count,
    -- receipts_count column, conditional calculation
    CASE WHEN $preCountReceipts = false THEN NULL ELSE (
      SELECT COUNT(*)
      FROM accounter_schema.documents d
      WHERE d.charge_id = c.id
        AND d.type IN ('RECEIPT', 'INVOICE_RECEIPT')
    ) END as receipts_count,
    -- ledger_records_count column, conditional calculation
    CASE WHEN $preCountLedger = false THEN NULL ELSE (
      SELECT COUNT(*)
      FROM accounter_schema.ledger l
      WHERE l.original_id = c.id
    ) END as ledger_records_count,
    -- balance column, conditional calculation
    CASE WHEN $preCalculateBalance = false THEN NULL ELSE (
      SELECT SUM(lr.amount) as balance
      FROM (
        SELECT debit_account_id_1 AS business_id, (debit_amount_1::DECIMAL * -1) AS amount, to_date(invoice_date, 'DD/MM/YYYY') as date, business as financial_entity_id
        FROM accounter_schema.ledger
        WHERE debit_amount_1 IS NOT NULL
        UNION ALL
        SELECT debit_account_id_2, (debit_amount_2::DECIMAL * -1), to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE debit_amount_2 IS NOT NULL
        UNION ALL
        SELECT credit_account_id_1, credit_amount_1::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE credit_amount_1 IS NOT NULL
        UNION ALL
        SELECT credit_account_id_2, credit_amount_2::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE credit_amount_2 IS NOT NULL
      ) lr
      WHERE lr.date <= (
        SELECT MAX(to_date(l.invoice_date, 'DD/MM/YYYY'))
        FROM accounter_schema.ledger l
        WHERE l.original_id = c.id
          AND lr.business_id = c.counterparty_id
          AND lr.financial_entity_id = c.owner_id)
    ) END as balance
  FROM accounter_schema.extended_charges c
  LEFT JOIN accounter_schema.businesses bu
  ON  c.counterparty_id = bu.id
  WHERE 
  ($isIDs = 0 OR c.id IN $$IDs)
  AND ($isFinancialEntityIds = 0 OR c.owner_id IN $$financialEntityIds)
  AND ($isBusinessesIDs = 0 OR c.counterparty_id IN $$businessesIDs)
  AND ($isNotBusinessesIDs = 0 OR c.counterparty_id NOT IN $$notBusinessesIDs)
  AND ($fromDate ::TEXT IS NULL OR c.transactions_min_event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
  AND ($toDate ::TEXT IS NULL OR c.transactions_max_event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
  AND ($chargeType = 'ALL' OR ($chargeType = 'INCOME' AND c.event_amount > 0) OR ($chargeType = 'EXPENSE' AND c.event_amount <= 0))
  ORDER BY
  CASE WHEN $asc = true AND $sortColumn = 'event_date' THEN c.transactions_min_event_date  END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'event_date'  THEN c.transactions_min_event_date  END DESC,
  CASE WHEN $asc = true AND $sortColumn = 'event_amount' THEN c.event_amount  END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'event_amount'  THEN c.event_amount  END DESC,
  CASE WHEN $asc = true AND $sortColumn = 'abs_event_amount' THEN ABS(cast(c.event_amount as DECIMAL))  END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'abs_event_amount'  THEN ABS(cast(c.event_amount as DECIMAL))  END DESC;
  `;

type IGetAdjustedChargesByFiltersParams = Optional<
  Omit<
    IGetChargesByFiltersParams,
    'isBusinesses' | 'isFinancialEntityIds' | 'isIDs' | 'isNotBusinesses'
  >,
  | 'businessesIDs'
  | 'financialEntityIds'
  | 'IDs'
  | 'notBusinessesIDs'
  | 'asc'
  | 'sortColumn'
  | 'toDate'
  | 'fromDate'
  | 'preCalculateBalance'
  | 'preCountInvoices'
  | 'preCountLedger'
  | 'preCountReceipts'
> & {
  toDate?: TimelessDateString | null;
  fromDate?: TimelessDateString | null;
};

const validateCharges = sql<IValidateChargesQuery>`
  SELECT
    c.*,
    (
      SELECT COUNT(*)
      FROM accounter_schema.documents d
      WHERE d.charge_id = c.id
        AND d.type IN ('INVOICE', 'INVOICE_RECEIPT')
    ) as invoices_count,
    (
      SELECT COUNT(*)
      FROM accounter_schema.documents d
      WHERE d.charge_id = c.id
        AND d.type IN ('RECEIPT', 'INVOICE_RECEIPT')
    ) as receipts_count,
    (
      SELECT COUNT(*)
      FROM accounter_schema.ledger l
      WHERE l.original_id = c.id
    ) as ledger_records_count,
    (
      SELECT SUM(lr.amount) as balance
      FROM (
        SELECT debit_account_id_1 AS business_id, (debit_amount_1::DECIMAL * -1) AS amount, to_date(invoice_date, 'DD/MM/YYYY') as date, business as financial_entity_id
        FROM accounter_schema.ledger
        WHERE debit_amount_1 IS NOT NULL
        UNION ALL
        SELECT debit_account_id_2, (debit_amount_2::DECIMAL * -1), to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE debit_amount_2 IS NOT NULL
        UNION ALL
        SELECT credit_account_id_1, credit_amount_1::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE credit_amount_1 IS NOT NULL
        UNION ALL
        SELECT credit_account_id_2, credit_amount_2::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE credit_amount_2 IS NOT NULL
      ) lr
      WHERE lr.date <= (
        SELECT MAX(to_date(l.invoice_date, 'DD/MM/YYYY'))
        FROM accounter_schema.ledger l
        WHERE l.original_id = c.id
          AND lr.business_id = c.counterparty_id
          AND lr.financial_entity_id = c.owner_id)
    ) as balance
  FROM accounter_schema.extended_charges c
  LEFT JOIN accounter_schema.businesses bu
  ON  c.counterparty_id = bu.id

  WHERE ($isFinancialEntityIds = 0 OR c.owner_id IN $$financialEntityIds)
    AND ($chargeType = 'ALL' OR ($chargeType = 'INCOME' AND c.event_amount > 0) OR ($chargeType = 'EXPENSE' AND c.event_amount <= 0))
    AND ($isIDs = 0 OR c.id IN $$IDs)
    AND ($fromDate ::TEXT IS NULL OR c.transactions_min_event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR c.transactions_max_event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY c.transactions_min_event_date DESC;
`;

const deleteChargesByIds = sql<IDeleteChargesByIdsQuery>`
    DELETE FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

type IValidateChargesAdjustedParams = Optional<
  Omit<IValidateChargesParams, 'isIDs' | 'isFinancialEntityIds'>,
  'IDs' | 'toDate' | 'fromDate' | 'financialEntityIds'
> & {
  toDate?: TimelessDateString | null;
  fromDate?: TimelessDateString | null;
};

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class ChargesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchChargesByIds(ids: readonly string[]) {
    const charges = (await getChargesByIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    )) as ChargeRequiredWrapper<IGetChargesByIdsResult>[];
    return ids.map(id => charges.find(charge => charge.id === id));
  }

  public getChargeByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByIds(keys),
    { cache: false },
  );

  public getChargesByFinancialAccountIds(params: IGetChargesByFinancialAccountIdsParams) {
    return getChargesByFinancialAccountIds.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IGetChargesByFinancialAccountIdsResult>[]
    >;
  }

  private async batchChargesByFinancialAccountIds(financialAccountIDs: readonly string[]) {
    const charges = (await getChargesByFinancialAccountIds.run(
      {
        financialAccountIDs,
        fromDate: null,
        toDate: null,
      },
      this.dbProvider,
    )) as ChargeRequiredWrapper<IGetChargesByFinancialAccountIdsResult>[];
    return financialAccountIDs.map(accountId =>
      charges.filter(charge => charge.account_id === accountId),
    );
  }

  public getChargeByFinancialAccountIDsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByFinancialAccountIds(keys),
    {
      cache: false,
    },
  );

  public getChargesByFinancialEntityIds(params: IGetChargesByFinancialEntityIdsParams) {
    return getChargesByFinancialEntityIds.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IGetChargesByFinancialEntityIdsResult>[]
    >;
  }

  private async batchChargesByFinancialEntityIds(financialEntityIds: readonly string[]) {
    const charges = (await getChargesByFinancialEntityIds.run(
      {
        financialEntityIds,
        fromDate: null,
        toDate: null,
      },
      this.dbProvider,
    )) as ChargeRequiredWrapper<IGetChargesByFinancialEntityIdsResult>[];
    return financialEntityIds.map(id => charges.filter(charge => charge.owner_id === id));
  }

  public getChargeByFinancialEntityIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByFinancialEntityIds(keys),
    {
      cache: false,
    },
  );

  // public getConversionOtherSide(params: IGetConversionOtherSideParams) {
  //   return getConversionOtherSide.run(params, this.dbProvider);
  // }

  public updateCharge(params: IUpdateChargeParams) {
    return updateCharge.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IUpdateChargeResult>[]
    >;
  }

  public getChargesByFilters(params: IGetAdjustedChargesByFiltersParams) {
    const isBusinessesIDs = !!params?.businessesIDs?.length;
    const isFinancialEntityIds = !!params?.financialEntityIds?.length;
    const isIDs = !!params?.IDs?.length;
    const isNotBusinessesIDs = !!params?.notBusinessesIDs?.length;

    const defaults = {
      asc: false,
      sortColumn: 'event_date',
    };

    const fullParams: IGetChargesByFiltersParams = {
      ...defaults,
      isBusinessesIDs: isBusinessesIDs ? 1 : 0,
      isFinancialEntityIds: isFinancialEntityIds ? 1 : 0,
      isIDs: isIDs ? 1 : 0,
      isNotBusinessesIDs: isNotBusinessesIDs ? 1 : 0,
      ...params,
      preCalculateBalance: params.preCalculateBalance ?? false,
      preCountInvoices: params.preCountInvoices ?? false,
      preCountLedger: params.preCountLedger ?? false,
      preCountReceipts: params.preCountReceipts ?? false,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      businessesIDs: isBusinessesIDs ? params.businessesIDs! : [null],
      financialEntityIds: isFinancialEntityIds ? params.financialEntityIds! : [null],
      IDs: isIDs ? params.IDs! : [null],
      notBusinessesIDs: isNotBusinessesIDs ? params.notBusinessesIDs! : [null],
      chargeType: params.chargeType ?? 'ALL',
    };
    return getChargesByFilters.run(fullParams, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IGetChargesByFiltersResult>[]
    >;
  }

  public validateCharges(params: IValidateChargesAdjustedParams) {
    const isIDs = !!params?.IDs?.length;
    const isFinancialEntityIds = !!params?.financialEntityIds?.length;

    const fullParams: IValidateChargesParams = {
      isIDs: isIDs ? 1 : 0,
      isFinancialEntityIds: isFinancialEntityIds ? 1 : 0,
      ...params,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      IDs: isIDs ? params.IDs! : [null],
      financialEntityIds: isFinancialEntityIds ? params.financialEntityIds! : [null],
      chargeType: params.chargeType ?? 'ALL',
    };
    return validateCharges.run(fullParams, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IValidateChargesResult>[]
    >;
  }

  private async batchValidateChargesByIds(ids: readonly string[]) {
    const isIDs = !!ids?.length;
    const charges = await this.validateCharges({
      IDs: isIDs ? ids : [null],
      fromDate: null,
      toDate: null,
      financialEntityIds: null,
    });
    return ids.map(id => {
      const charge = charges.find(charge => charge.id === id);
      return charge ? validateCharge(charge) : null;
    });
  }

  public validateChargeByIdLoader = new DataLoader<string, ChargesModule.ValidationData | null>(
    keys => this.batchValidateChargesByIds(keys),
    { cache: false },
  );

  public deleteChargesByIds(params: IDeleteChargesByIdsParams) {
    return deleteChargesByIds.run(params, this.dbProvider);
  }
}
