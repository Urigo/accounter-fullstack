import pgQuery from '@pgtyped/query';
import {
  IGetChargesByFinancialAccountNumbersQuery,
  IGetChargesByFinancialEntityIdsQuery,
  IUpdateChargeQuery,
  IGetChargesByIdsQuery,
} from '../__generated__/charges.types.mjs';
import DataLoader from 'dataloader';
import { pool } from '../providers/db.mjs';

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
    pool
  );
  return ids.map(id => charges.find(charge => charge.id === id));
}

export const getChargeByIdLoader = new DataLoader(batchChargesByIds);

export const getChargesByFinancialAccountNumbers = sql<IGetChargesByFinancialAccountNumbersQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE account_number IN $$financialAccountNumbers
    AND ($fromDate ::TEXT IS NULL OR event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY event_date DESC;`;

async function batchChargesByFinancialAccountNumbers(financialAccountNumbers: readonly number[]) {
  const charges = await getChargesByFinancialAccountNumbers.run(
    {
      financialAccountNumbers,
      fromDate: null,
      toDate: null,
    },
    pool
  );
  return financialAccountNumbers.map(accountNumber =>
    charges.filter(charge => charge.account_number === accountNumber)
  );
}

export const getChargeByFinancialAccountNumberLoader = new DataLoader(batchChargesByFinancialAccountNumbers);

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
    pool
  );
  return financialEntityIds.map(id => charges.filter(charge => charge.financial_entity_id === id));
}

export const getChargeByFinancialEntityIdLoader = new DataLoader(batchChargesByFinancialEntityIds);

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
