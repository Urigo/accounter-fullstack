alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_short_product_name_enum check (data_0_short_product_name in ('פריים'));



alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_hebrew_purpose_description_enum check (data_0_hebrew_purpose_description in ('לא רלוונטי'));

alter table accounter_schema.poalim_deposits_account_transactions drop constraint data_0_renewal_description_enum;
alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_renewal_description_enum check (data_0_renewal_description in ('פיקדון מתחדש', 'יפרע לעו"ש'));

alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_interest_base_description_enum check (data_0_interest_base_description in ('פריים'));
alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_interest_type_description_enum check (data_0_interest_type_description in ('משתנה'));
alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_interest_calculating_method_description_enum check (data_0_interest_calculating_method_description in ('קו ישר'));
alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_interest_crediting_method_description_enum check (data_0_interest_crediting_method_description in ('לקרן הפיקדון'));
alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_interest_payment_description_enum check (data_0_interest_payment_description in ('תחנה'));
alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_lien_description_enum check (data_0_lien_description in ('משועבד'));
alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_time_unit_description_enum check (data_0_time_unit_description in ('ימים'));


alter table accounter_schema.poalim_deposits_account_transactions drop constraint data_0_renewal_date_explanation_enum;
alter table accounter_schema.poalim_deposits_account_transactions add constraint data_0_renewal_date_explanation_enum check (data_0_renewal_date_explanation in ('תחנה קרובה', 'ייפרע לעו"ש בתאריך'));


alter table accounter_schema.poalim_deposits_account_transactions add constraint source_enum check (source in ('israeliCurrencyDeposit'));


drop view merged_tables cascade ;

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
       id,
       reviewed,
       hashavshevet_id,
       current_balance,
       tax_invoice_file,
       concat(
           activity_description,
           ' ',
           coalesce(beneficiary_details_data_party_name,''),
           ' ',
           coalesce(beneficiary_details_data_message_detail,''),
           ' ',
           coalesce(english_action_desc,'')
       ) as detailed_bank_description -- Delete and move to JS
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
       id,
       reviewed,
       hashavshevet_id,
       current_balance,
       tax_invoice_file,
       concat(
           activity_description,
           ' ',
           coalesce(event_details,''),
           ' ',
           coalesce(account_name,'')
       ) as detailed_bank_description
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
       id,
       reviewed,
       hashavshevet_id,
       current_balance,
       tax_invoice_file,
              concat(
           activity_description,
           ' ',
           coalesce(event_details,''),
           ' ',
           coalesce(account_name,'')
       ) as detailed_bank_description
FROM accounter_schema.poalim_eur_account_transactions;