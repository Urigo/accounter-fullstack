SELECT
  *
FROM
  accounter.accounter_schema.isracard_creditcard_transactions
WHERE
  full_payment_date IS NULL
  AND currency_id <> 'ש"ח'
  AND currency_id <> 'NIS'
  AND full_supplier_name_outbound <> 'TOTAL FOR DATE'
  AND full_supplier_name_outbound <> 'CASH ADVANCE FEE';

SELECT
  *
FROM
  accounter.accounter_schema.poalim_usd_account_transactions
WHERE
  value_date IS NULL;

SELECT
  *
FROM
  accounter.accounter_schema.poalim_eur_account_transactions
WHERE
  value_date IS NULL;