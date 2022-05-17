import pgQuery from '@pgtyped/query';
import {
  IGetChargesByFinancialAccountNumbersQuery,
  IGetChargesByFinancialEntityIdsQuery,
  IUpdateChargeQuery,
} from '../__generated__/charges.types.mjs';

const { sql } = pgQuery;

export const getChargesByFinancialAccountNumbers = sql<IGetChargesByFinancialAccountNumbersQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE account_number IN $$financialAccountNumbers
    AND ($fromDate ::TEXT IS NULL OR event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY event_date DESC;`;

export const getChargesByFinancialEntityIds = sql<IGetChargesByFinancialEntityIdsQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE account_number IN (
      SELECT account_number
      FROM accounter_schema.financial_accounts
      WHERE owner IN $$financialEntityIds
    )
    AND ($fromDate ::TEXT IS NULL OR event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY event_date DESC;`;

export const updateCharge = sql<IUpdateChargeQuery>`
  UPDATE accounter_schema.all_transactions
  SET
  tax_invoice_date = COALESCE(
    $taxInvoiceDate,
    (SELECT tax_invoice_date FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  tax_category = COALESCE(
    $taxCategory,
    (SELECT tax_category FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  currency_code = COALESCE(
    $currencyCode,
    (SELECT currency_code FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  event_date = COALESCE(
    $eventDate,
    (SELECT event_date FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  debit_date = COALESCE(
    $debitDate,
    (SELECT debit_date FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  event_amount = COALESCE(
    $eventAmount,
    (SELECT event_amount FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  financial_entity = COALESCE(
    $financialEntity,
    (SELECT financial_entity FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  vat = COALESCE(
    $vat,
    (SELECT vat FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  user_description = COALESCE(
    $userDescription,
    (SELECT user_description FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  tax_invoice_number = COALESCE(
    $taxInvoiceNumber,
    (SELECT tax_invoice_number FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  tax_invoice_amount = COALESCE(
    $taxInvoiceAmount,
    (SELECT tax_invoice_amount FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  receipt_number = COALESCE(
    $receiptNumber,
    (SELECT receipt_number FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  business_trip = COALESCE(
    $businessTrip,
    (SELECT business_trip FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  personal_category = COALESCE(
    $personalCategory,
    (SELECT personal_category FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  financial_accounts_to_balance = COALESCE(
    $financialAccountsToBalance,
    (SELECT financial_accounts_to_balance FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  bank_reference = COALESCE(
    $bankReference,
    (SELECT bank_reference FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  event_number = COALESCE(
    $eventNumber,
    (SELECT event_number FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  account_number = COALESCE(
    $accountNumber,
    (SELECT account_number FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  account_type = COALESCE(
    $accountType,
    (SELECT account_type FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  is_conversion = COALESCE(
    $isConversion,
    (SELECT is_conversion FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  currency_rate = COALESCE(
    $currencyRate,
    (SELECT currency_rate FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  contra_currency_code = COALESCE(
    $contraCurrencyCode,
    (SELECT contra_currency_code FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  bank_description = COALESCE(
    $bankDescription,
    (SELECT bank_description FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  withholding_tax = COALESCE(
    $withholdingTax,
    (SELECT withholding_tax FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  interest = COALESCE(
    $interest,
    (SELECT interest FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  proforma_invoice_file = COALESCE(
    $proformaInvoiceFile,
    (SELECT proforma_invoice_file FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  original_id = COALESCE(
    $originalId,
    (SELECT original_id FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  reviewed = COALESCE(
    $reviewed,
    (SELECT reviewed FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  hashavshevet_id = COALESCE(
    $hashavshevetId,
    (SELECT hashavshevet_id FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  current_balance = COALESCE(
    $currentBalance,
    (SELECT current_balance FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  tax_invoice_file = COALESCE(
    $taxInvoiceFile,
    (SELECT tax_invoice_file FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  detailed_bank_description = COALESCE(
    $detailedBankDescription,
    (SELECT detailed_bank_description FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  links = COALESCE(
    $links,
    (SELECT links FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  receipt_date = COALESCE(
    $receiptDate,
    (SELECT receipt_date FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  receipt_url = COALESCE(
    $receiptUrl,
    (SELECT receipt_url FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  receipt_image = COALESCE(
    $receiptImage,
    (SELECT receipt_image FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  is_property = COALESCE(
    $isProperty,
    (SELECT is_property FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  ),
  tax_invoice_currency = COALESCE(
    $taxInvoiceCurrency,
    (SELECT tax_invoice_currency FROM accounter_schema.all_transactions WHERE id = $chargeId),
    NULL
  )
  WHERE
    id = $chargeId
  RETURNING *;
`;
