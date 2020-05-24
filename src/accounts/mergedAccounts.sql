CREATE OR REPLACE VIEW merged_tables AS
SELECT *
FROM all_creditcard_transactions
UNION
SELECT tax_invoice_date,
       tax_category,
       'ILS'                      AS currency_code,
       event_date::text::date,
       event_date::text::date     AS debit_date,
       (CASE
            WHEN event_activity_type_code = 2 THEN (event_amount * -1)
            ELSE event_amount END
           )                      AS event_amount,
       financial_entity,
       vat,
       user_description,
       tax_invoice_number,
       tax_invoice_amount,
       receipt_invoice_number,
       business_trip,
       personal_category,
       even_with_dotan            AS financial_accounts_to_balance,
       reference_number           AS bank_reference,
       expanded_event_date        AS event_number,
       account_number,
       'checking_ils'             AS account_type,
       (activity_type_code = 142) AS is_conversion,
       0                          AS currency_rate,
       null::integer              as contra_currency_code, -- maybe if I'll do a transfer it will also show up?
       activity_description       AS bank_description,
       withholding_tax,
       interest,
       proforma_invoice_file,
       id
FROM accounter_schema.poalim_ils_account_transactions
UNION
SELECT tax_invoice_date,
       tax_category,
       'USD'                   AS currency_code,
       executing_date::text::date,
       value_date::text::date  AS debit_date,
       (CASE
            WHEN event_activity_type_code = 2 THEN (event_amount * -1)
            ELSE event_amount END
           )                   AS event_amount,
       financial_entity,
       vat,
       user_description,
       tax_invoice_number,
       tax_invoice_amount,
       receipt_invoice_number,
       business_trip,
       personal_category,
       even_with_dotan         as financial_accounts_to_balance,
       reference_number        AS bank_reference,
       event_number,
       account_number,
       'checking_usd'          AS account_type,
       (rate_fixing_code <> 0) AS is_conversion,
       currency_rate,
       contra_currency_code,
       activity_description || COALESCE('/' || event_details, '') AS bank_description,
       withholding_tax,
       interest,
       proforma_invoice_file,
       id
FROM accounter_schema.poalim_usd_account_transactions
UNION
SELECT tax_invoice_date,
       tax_category,
       'EUR'                   AS currency_code,
       executing_date::text::date,
       value_date::text::date  AS debit_date,
       (CASE
            WHEN event_activity_type_code = 2 THEN (event_amount * -1)
            ELSE event_amount END
           )                   AS event_amount,
       financial_entity,
       vat,
       user_description,
       tax_invoice_number,
       tax_invoice_amount,
       receipt_invoice_number,
       business_trip,
       personal_category,
       even_with_dotan         AS financial_accounts_to_balance,
       reference_number        AS bank_reference,
       event_number,
       account_number,
       'checking_eur'          AS account_type,
       (rate_fixing_code <> 0) AS is_conversion,
       currency_rate,
       contra_currency_code,
       activity_description || COALESCE('/' || event_details, '') AS bank_description,
       withholding_tax,
       interest,
       proforma_invoice_file,
       id
FROM accounter_schema.poalim_eur_account_transactions;