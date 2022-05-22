DROP VIEW all_creditcard_transactions CASCADE;

CREATE
OR REPLACE VIEW all_creditcard_transactions AS
SELECT
  tax_invoice_date,
  tax_category,
  (
    CASE
      WHEN currency_id = 'ש"ח' THEN 'ILS'
      WHEN currency_id = 'NIS' THEN 'ILS'
      ELSE currency_id
    END
  ) AS currency_code,
  CASE
    WHEN full_purchase_date IS NULL THEN full_purchase_date_outbound :: TEXT :: date
    WHEN full_purchase_date_outbound IS NULL THEN full_purchase_date :: TEXT :: date
  END AS event_date,
  full_payment_date :: TEXT :: date AS debit_date,
  CASE
    WHEN payment_sum IS NULL THEN (payment_sum_outbound * -1)
    WHEN payment_sum_outbound IS NULL THEN (payment_sum * -1)
  END AS event_amount,
  financial_entity,
  vat,
  user_description,
  tax_invoice_number,
  tax_invoice_amount,
  receipt_invoice_number,
  business_trip,
  personal_category,
  even_with_dotan AS financial_accounts_to_balance,
  voucher_number AS bank_reference,
  voucher_number AS event_number,
  card AS account_number,
  'creditcard' AS account_type,
  FALSE AS is_conversion,
  0 AS currency_rate,
  NULL :: INTEGER AS contra_currency_code,
  CASE
    WHEN full_supplier_name_outbound IS NULL THEN full_supplier_name_heb
    WHEN full_supplier_name_heb IS NULL THEN (
      COALESCE(full_supplier_name_outbound, '') | | COALESCE('/' | | city, '')
    )
  END AS bank_description,
  withholding_tax,
  interest,
  proforma_invoice_file,
  id,
  reviewed,
  hashavshevet_id,
  0 AS current_balance,
  tax_invoice_file,
  CASE
    WHEN full_supplier_name_outbound IS NULL THEN full_supplier_name_heb
    WHEN full_supplier_name_heb IS NULL THEN (
      COALESCE(full_supplier_name_outbound, '') | | COALESCE('/' | | city, '')
    )
  END AS detailed_bank_description
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  (
    full_supplier_name_outbound <> 'TOTAL FOR DATE'
    OR full_supplier_name_outbound IS NULL
  )
  AND (
    full_supplier_name_outbound <> 'CASH ADVANCE FEE'
    OR full_supplier_name_outbound IS NULL
  )
  AND (
    supplier_name <> 'סך חיוב בש"ח:'
    OR supplier_name IS NULL
  );