SELECT
  *
FROM
  accounter_schema.all_transactions
WHERE
  account_number IN ('466803', '1074', '1082')
ORDER BY
  event_date::TEXT::date,
  event_number;

SELECT
  pils.serial_number,
  AT.*
FROM
  accounter_schema.all_transactions AT
  LEFT JOIN accounter_schema.poalim_ils_account_transactions pils ON pils.id = AT.original_id
  LEFT JOIN accounter_schema.poalim_usd_account_transactions pusd ON pusd.id = AT.original_id
  LEFT JOIN accounter_schema.poalim_eur_account_transactions peur ON peur.id = AT.original_id
WHERE
  AT.account_number IN ('466803', '1074', '1082')
ORDER BY
  AT.event_date::TEXT::date,
  AT.event_number,
  GREATEST(pils.serial_number);

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_short_product_name_enum CHECK (data_0_short_product_name IN ('פריים'));

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_hebrew_purpose_description_enum CHECK (
    data_0_hebrew_purpose_description IN ('לא רלוונטי')
  );

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions DROP CONSTRAINT data_0_renewal_description_enum;

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_renewal_description_enum CHECK (
    data_0_renewal_description IN ('פיקדון מתחדש', 'יפרע לעו"ש')
  );

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_interest_base_description_enum CHECK (data_0_interest_base_description IN ('פריים'));

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_interest_type_description_enum CHECK (data_0_interest_type_description IN ('משתנה'));

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_interest_calculating_method_description_enum CHECK (
    data_0_interest_calculating_method_description IN ('קו ישר')
  );

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_interest_crediting_method_description_enum CHECK (
    data_0_interest_crediting_method_description IN ('לקרן הפיקדון')
  );

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_interest_payment_description_enum CHECK (data_0_interest_payment_description IN ('תחנה'));

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions DROP CONSTRAINT data_0_lien_description_enum;

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_lien_description_enum CHECK (
    data_0_lien_description IN ('משועבד', 'מבטיח אשראי')
  );

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_time_unit_description_enum CHECK (data_0_time_unit_description IN ('ימים'));

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions DROP CONSTRAINT data_0_renewal_date_explanation_enum;

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT data_0_renewal_date_explanation_enum CHECK (
    data_0_renewal_date_explanation IN ('תחנה קרובה', 'ייפרע לעו"ש בתאריך')
  );

ALTER TABLE
  accounter_schema.poalim_deposits_account_transactions
ADD
  CONSTRAINT source_enum CHECK (source IN ('israeliCurrencyDeposit'));

DROP VIEW
  merged_tables CASCADE;

CREATE
OR REPLACE VIEW merged_tables AS
SELECT
  *
FROM
  all_creditcard_transactions
UNION
SELECT
  tax_invoice_date,
  tax_category,
  'ILS' AS currency_code,
  event_date::TEXT::date,
  event_date::TEXT::date AS debit_date,
  (
    CASE
      WHEN event_activity_type_code = 2 THEN (event_amount * -1)
      ELSE event_amount
    END
  ) AS event_amount,
  financial_entity,
  vat,
  user_description,
  tax_invoice_number,
  tax_invoice_amount,
  receipt_invoice_number,
  business_trip,
  personal_category,
  even_with_dotan AS financial_accounts_to_balance,
  reference_number AS bank_reference,
  expanded_event_date AS event_number,
  account_number,
  'checking_ils' AS account_type,
  (activity_type_code = 142) AS is_conversion,
  0 AS currency_rate,
  NULL::INTEGER AS contra_currency_code,
  -- maybe if I'll do a transfer it will also show up?
  activity_description AS bank_description,
  withholding_tax,
  interest,
  proforma_invoice_file,
  id,
  reviewed,
  hashavshevet_id,
  current_balance,
  tax_invoice_file,
  concat(
    activity_description,
    ' ',
    COALESCE(beneficiary_details_data_party_name, ''),
    ' ',
    COALESCE(beneficiary_details_data_message_detail, ''),
    ' ',
    COALESCE(english_action_desc, '')
  ) AS detailed_bank_description -- Delete and move to JS
FROM
  accounter_schema.poalim_ils_account_transactions
UNION
SELECT
  tax_invoice_date,
  tax_category,
  'USD' AS currency_code,
  executing_date::TEXT::date,
  value_date::TEXT::date AS debit_date,
  (
    CASE
      WHEN event_activity_type_code = 2 THEN (event_amount * -1)
      ELSE event_amount
    END
  ) AS event_amount,
  financial_entity,
  vat,
  user_description,
  tax_invoice_number,
  tax_invoice_amount,
  receipt_invoice_number,
  business_trip,
  personal_category,
  even_with_dotan AS financial_accounts_to_balance,
  reference_number AS bank_reference,
  event_number,
  account_number,
  'checking_usd' AS account_type,
  (rate_fixing_code <> 0) AS is_conversion,
  currency_rate,
  contra_currency_code,
  activity_description | | COALESCE('/' | | event_details, '') AS bank_description,
  withholding_tax,
  interest,
  proforma_invoice_file,
  id,
  reviewed,
  hashavshevet_id,
  current_balance,
  tax_invoice_file,
  concat(
    activity_description,
    ' ',
    COALESCE(event_details, ''),
    ' ',
    COALESCE(account_name, '')
  ) AS detailed_bank_description
FROM
  accounter_schema.poalim_usd_account_transactions
UNION
SELECT
  tax_invoice_date,
  tax_category,
  'EUR' AS currency_code,
  executing_date::TEXT::date,
  value_date::TEXT::date AS debit_date,
  (
    CASE
      WHEN event_activity_type_code = 2 THEN (event_amount * -1)
      ELSE event_amount
    END
  ) AS event_amount,
  financial_entity,
  vat,
  user_description,
  tax_invoice_number,
  tax_invoice_amount,
  receipt_invoice_number,
  business_trip,
  personal_category,
  even_with_dotan AS financial_accounts_to_balance,
  reference_number AS bank_reference,
  event_number,
  account_number,
  'checking_eur' AS account_type,
  (rate_fixing_code <> 0) AS is_conversion,
  currency_rate,
  contra_currency_code,
  activity_description | | COALESCE('/' | | event_details, '') AS bank_description,
  withholding_tax,
  interest,
  proforma_invoice_file,
  id,
  reviewed,
  hashavshevet_id,
  current_balance,
  tax_invoice_file,
  concat(
    activity_description,
    ' ',
    COALESCE(event_details, ''),
    ' ',
    COALESCE(account_name, '')
  ) AS detailed_bank_description
FROM
  accounter_schema.poalim_eur_account_transactions;
