import pgQuery, { TaggedQuery } from '@pgtyped/query';
import { IDatabaseConnection } from '@pgtyped/query/lib/tag.js';
import DataLoader from 'dataloader';
import {
  IGetChargesByFiltersParams,
  IGetChargesByFiltersQuery,
  IGetChargesByFiltersResult,
  IGetChargesByFinancialAccountNumbersQuery,
  IGetChargesByFinancialEntityIdsQuery,
  IGetChargesByIdsQuery,
  IGetConversionOtherSideQuery,
  IUpdateChargeQuery,
  IValidateChargesParams,
  IValidateChargesQuery,
  IValidateChargesResult,
} from '../__generated__/charges.types.mjs';
import { ValidationData } from '../__generated__/types.mjs';
import { validateCharge } from '../helpers/charges.mjs';
import { Optional } from '../helpers/misc.mjs';
import { pool } from '../providers/db.mjs';
import { TimelessDateString } from '../scalars/timeless-date.mjs';

const { sql } = pgQuery;

const getChargesByIds = sql<IGetChargesByIdsQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE id IN $$cahrgeIds;`;

async function batchChargesByIds(ids: readonly string[]) {
  const charges = await getChargesByIds.run(
    {
      cahrgeIds: ids,
    },
    pool,
  );
  return ids.map(id => charges.find(charge => charge.id === id));
}

export const getChargeByIdLoader = new DataLoader(batchChargesByIds, { cache: false });

export const getChargesByFinancialAccountNumbers = sql<IGetChargesByFinancialAccountNumbersQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE account_number IN $$financialAccountNumbers
    AND ($fromDate ::TEXT IS NULL OR event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY event_date DESC;`;

async function batchChargesByFinancialAccountNumbers(financialAccountNumbers: readonly string[]) {
  const charges = await getChargesByFinancialAccountNumbers.run(
    {
      financialAccountNumbers,
      fromDate: null,
      toDate: null,
    },
    pool,
  );
  return financialAccountNumbers.map(accountNumber =>
    charges.filter(charge => charge.account_number === accountNumber),
  );
}

export const getChargeByFinancialAccountNumberLoader = new DataLoader(
  batchChargesByFinancialAccountNumbers,
  {
    cache: false,
  },
);

export const getChargesByFinancialEntityIds = sql<IGetChargesByFinancialEntityIdsQuery>`
    SELECT at.*, fa.owner as financial_entity_id
    FROM accounter_schema.all_transactions at
    LEFT JOIN accounter_schema.financial_accounts fa
    ON  at.account_number = fa.account_number
    WHERE fa.owner IN $$financialEntityIds
    AND ($fromDate ::TEXT IS NULL OR at.event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR at.event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY at.event_date DESC;`;

async function batchChargesByFinancialEntityIds(financialEntityIds: readonly string[]) {
  const charges = await getChargesByFinancialEntityIds.run(
    {
      financialEntityIds,
      fromDate: null,
      toDate: null,
    },
    pool,
  );
  return financialEntityIds.map(id => charges.filter(charge => charge.financial_entity_id === id));
}

export const getChargeByFinancialEntityIdLoader = new DataLoader(batchChargesByFinancialEntityIds, {
  cache: false,
});

export const getConversionOtherSide = sql<IGetConversionOtherSideQuery>`
    SELECT event_amount, currency_code
    FROM accounter_schema.all_transactions
    WHERE bank_reference = $bankReference
      AND id <> $chargeId
      LIMIT 1;`;

export const updateCharge = sql<IUpdateChargeQuery>`
  UPDATE accounter_schema.all_transactions
  SET
  tax_invoice_date = COALESCE(
    $taxInvoiceDate,
    tax_invoice_date,
    NULL
  ),
  tax_category = COALESCE(
    $taxCategory,
    tax_category,
    NULL
  ),
  currency_code = COALESCE(
    $currencyCode,
    currency_code,
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
  event_amount = COALESCE(
    $eventAmount,
    event_amount,
    NULL
  ),
  financial_entity = COALESCE(
    $financialEntity,
    financial_entity,
    NULL
  ),
  vat = COALESCE(
    $vat,
    vat,
    NULL
  ),
  user_description = COALESCE(
    $userDescription,
    user_description,
    NULL
  ),
  tax_invoice_number = COALESCE(
    $taxInvoiceNumber,
    tax_invoice_number,
    NULL
  ),
  tax_invoice_amount = COALESCE(
    $taxInvoiceAmount,
    tax_invoice_amount,
    NULL
  ),
  receipt_number = COALESCE(
    $receiptNumber,
    receipt_number,
    NULL
  ),
  business_trip = COALESCE(
    $businessTrip,
    business_trip,
    NULL
  ),
  personal_category = COALESCE(
    $personalCategory,
    personal_category,
    NULL
  ),
  financial_accounts_to_balance = COALESCE(
    $financialAccountsToBalance,
    financial_accounts_to_balance,
    NULL
  ),
  bank_reference = COALESCE(
    $bankReference,
    bank_reference,
    NULL
  ),
  event_number = COALESCE(
    $eventNumber,
    event_number,
    NULL
  ),
  account_number = COALESCE(
    $accountNumber,
    account_number,
    NULL
  ),
  account_type = COALESCE(
    $accountType,
    account_type,
    NULL
  ),
  is_conversion = COALESCE(
    $isConversion,
    is_conversion,
    NULL
  ),
  currency_rate = COALESCE(
    $currencyRate,
    currency_rate,
    NULL
  ),
  contra_currency_code = COALESCE(
    $contraCurrencyCode,
    contra_currency_code,
    NULL
  ),
  bank_description = COALESCE(
    $bankDescription,
    bank_description,
    NULL
  ),
  withholding_tax = COALESCE(
    $withholdingTax,
    withholding_tax,
    NULL
  ),
  interest = COALESCE(
    $interest,
    interest,
    NULL
  ),
  proforma_invoice_file = COALESCE(
    $proformaInvoiceFile,
    proforma_invoice_file,
    NULL
  ),
  original_id = COALESCE(
    $originalId,
    original_id,
    NULL
  ),
  reviewed = COALESCE(
    $reviewed,
    reviewed,
    NULL
  ),
  hashavshevet_id = COALESCE(
    $hashavshevetId,
    hashavshevet_id,
    NULL
  ),
  current_balance = COALESCE(
    $currentBalance,
    current_balance,
    NULL
  ),
  tax_invoice_file = COALESCE(
    $taxInvoiceFile,
    tax_invoice_file,
    NULL
  ),
  detailed_bank_description = COALESCE(
    $detailedBankDescription,
    detailed_bank_description,
    NULL
  ),
  links = COALESCE(
    $links,
    links,
    NULL
  ),
  receipt_date = COALESCE(
    $receiptDate,
    receipt_date,
    NULL
  ),
  receipt_url = COALESCE(
    $receiptUrl,
    receipt_url,
    NULL
  ),
  receipt_image = COALESCE(
    $receiptImage,
    receipt_image,
    NULL
  ),
  is_property = COALESCE(
    $isProperty,
    is_property,
    NULL
  ),
  tax_invoice_currency = COALESCE(
    $taxInvoiceCurrency,
    tax_invoice_currency,
    NULL
  )
  WHERE
    id = $chargeId
  RETURNING *;
`;

const getChargesByFilters = sql<IGetChargesByFiltersQuery>`
    SELECT at.*, fa.owner as financial_entity_id, ABS(cast(at.event_amount as DECIMAL)) as abs_event_amount
    FROM accounter_schema.all_transactions at
    LEFT JOIN accounter_schema.financial_accounts fa
    ON  at.account_number = fa.account_number
    WHERE 
    ($isIDs = 0 OR at.id IN $$IDs)
    AND ($isFinancialEntityIds = 0 OR fa.owner IN $$financialEntityIds)
    AND ($isBusinesses = 0 OR at.financial_entity IN $$businesses)
    AND ($isNotBusinesses = 0 OR at.financial_entity NOT IN $$notBusinesses)
    AND ($fromDate ::TEXT IS NULL OR at.event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR at.event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY
    CASE WHEN $asc = true AND $sortColumn = 'event_date' THEN at.event_date  END ASC,
    CASE WHEN $asc = false AND $sortColumn = 'event_date'  THEN at.event_date  END DESC,
    CASE WHEN $asc = true AND $sortColumn = 'event_amount' THEN at.event_amount  END ASC,
    CASE WHEN $asc = false AND $sortColumn = 'event_amount'  THEN at.event_amount  END DESC,
    CASE WHEN $asc = true AND $sortColumn = 'abs_event_amount' THEN ABS(cast(at.event_amount as DECIMAL))  END ASC,
    CASE WHEN $asc = false AND $sortColumn = 'abs_event_amount'  THEN ABS(cast(at.event_amount as DECIMAL))  END DESC;
    `;

type IGetAdjustedChargesByFiltersParams = Optional<
  Omit<
    IGetChargesByFiltersParams,
    'isBusinesses' | 'isFinancialEntityIds' | 'isIDs' | 'isNotBusinesses'
  >,
  | 'businesses'
  | 'financialEntityIds'
  | 'IDs'
  | 'notBusinesses'
  | 'asc'
  | 'sortColumn'
  | 'toDate'
  | 'fromDate'
> & {
  toDate?: TimelessDateString | null;
  fromDate?: TimelessDateString | null;
};

const getAdjustedChargesByFilters: Pick<
  TaggedQuery<{
    params: IGetAdjustedChargesByFiltersParams;
    result: IGetChargesByFiltersResult;
  }>,
  'run'
> = {
  run(params: IGetAdjustedChargesByFiltersParams, dbConnection: IDatabaseConnection) {
    const isBusinesses = Boolean(params?.businesses?.length);
    const isFinancialEntityIds = Boolean(params?.financialEntityIds?.length);
    const isIDs = Boolean(params?.IDs?.length);
    const isNotBusinesses = Boolean(params?.notBusinesses?.length);

    const defaults = {
      asc: false,
      sortColumn: 'event_date',
    };

    const fullParams: IGetChargesByFiltersParams = {
      ...defaults,
      isBusinesses: isBusinesses ? 1 : 0,
      isFinancialEntityIds: isFinancialEntityIds ? 1 : 0,
      isIDs: isIDs ? 1 : 0,
      isNotBusinesses: isNotBusinesses ? 1 : 0,
      ...params,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      businesses: isBusinesses ? params.businesses! : [null],
      financialEntityIds: isFinancialEntityIds ? params.financialEntityIds! : [null],
      IDs: isIDs ? params.IDs! : [null],
      notBusinesses: isNotBusinesses ? params.notBusinesses! : [null],
    };
    return getChargesByFilters.run(fullParams, dbConnection);
  },
};

const validateCharges = sql<IValidateChargesQuery>`
  SELECT
    at.*,
    fa.owner as financial_entity_id,
    (bu.country <> 'Israel') as is_foreign,
    bu.no_invoices,
    (
      SELECT COUNT(*)
      FROM accounter_schema.documents d
      WHERE d.charge_id = at.id
        AND d.type IN ('INVOICE', 'INVOICE_RECEIPT')
    ) as invoices_count,
    (
      SELECT COUNT(*)
      FROM accounter_schema.documents d
      WHERE d.charge_id = at.id
        AND d.type IN ('RECEIPT', 'INVOICE_RECEIPT')
    ) as receipts_count,
    (
      SELECT COUNT(*)
      FROM accounter_schema.ledger l
      WHERE l.original_id = at.id
    ) as ledger_records_count,
    (
      SELECT SUM(lr.amount) as balance
      FROM (
        SELECT debit_account_1 AS business_name, (debit_amount_1::DECIMAL * -1) AS amount, to_date(invoice_date, 'DD/MM/YYYY') as date, business as financial_entity_id
        FROM accounter_schema.ledger
        WHERE debit_amount_1 IS NOT NULL
        UNION ALL
        SELECT debit_account_2, (debit_amount_2::DECIMAL * -1), to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE debit_amount_2 IS NOT NULL
        UNION ALL
        SELECT credit_account_1, credit_amount_1::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE credit_amount_1 IS NOT NULL
        UNION ALL
        SELECT credit_account_2, credit_amount_2::DECIMAL, to_date(invoice_date, 'DD/MM/YYYY'), business
        FROM accounter_schema.ledger
        WHERE credit_amount_2 IS NOT NULL
      ) lr
      WHERE lr.date <= (
        SELECT MIN(to_date(l.invoice_date, 'DD/MM/YYYY'))
        FROM accounter_schema.ledger l
        WHERE l.original_id = at.id
          AND lr.business_name = at.financial_entity
          AND lr.financial_entity_id = fa.owner)
    ) as balance
  FROM accounter_schema.all_transactions at
  LEFT JOIN accounter_schema.financial_accounts fa
  ON  at.account_number = fa.account_number
  LEFT JOIN accounter_schema.businesses bu
  ON  at.financial_entity = bu.name
  WHERE ($isFinancialEntityId = 0 OR fa.owner = $financialEntityId)
    AND ($isIDs = 0 OR at.id IN $$IDs)
    AND ($fromDate ::TEXT IS NULL OR at.event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR at.event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY at.event_date DESC;
`;

type IValidateChargesAdjustedParams = Optional<
  Omit<IValidateChargesParams, 'isIDs' | 'isFinancialEntityId'>,
  'IDs' | 'toDate' | 'fromDate'
> & {
  toDate?: TimelessDateString | null;
  fromDate?: TimelessDateString | null;
};

const validateChargesAdjusted: Pick<
  TaggedQuery<{
    params: IValidateChargesAdjustedParams;
    result: IValidateChargesResult;
  }>,
  'run'
> = {
  run(params: IValidateChargesAdjustedParams, dbConnection: IDatabaseConnection) {
    const isIDs = Boolean(params?.IDs?.length);

    const fullParams: IValidateChargesParams = {
      isIDs: isIDs ? 1 : 0,
      isFinancialEntityId: 1,
      ...params,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      IDs: isIDs ? params.IDs! : [null],
    };
    return validateCharges.run(fullParams, dbConnection);
  },
};

export {
  getAdjustedChargesByFilters as getChargesByFilters,
  validateChargesAdjusted as validateCharges,
};

async function batchValidateChargesByIds(ids: readonly string[]) {
  const isIDs = Boolean(ids?.length);
  const charges = await validateCharges.run(
    {
      isIDs: 1,
      IDs: isIDs ? ids : [null],
      fromDate: null,
      toDate: null,
      isFinancialEntityId: 0,
      financialEntityId: null,
    },
    pool,
  );
  return ids.map(id => {
    const charge = charges.find(charge => charge.id === id);
    return charge ? validateCharge(charge) : null;
  });
}

export const validateChargeByIdLoader = new DataLoader<string, ValidationData | null>(
  batchValidateChargesByIds,
  { cache: false },
);
