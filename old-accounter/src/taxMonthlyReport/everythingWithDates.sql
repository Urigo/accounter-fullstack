SELECT *
                FROM accounter_schema.all_transactions
                WHERE
                      account_number in ('2733', '61066')  and
                        event_date::text::date >= (date_trunc('month', to_date('2021-04-01', 'YYYY-MM-DD')))::date AND
                        event_date::text::date <= (date_trunc('month', to_date('2021-04-01', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day')::date AND
                        vat > 0;

SELECT *
                FROM accounter_schema.all_transactions
                WHERE
                      account_number in ('466803', '1074', '1082')  and
                        event_date >= date_trunc('month', to_date('2021-04-01', 'YYYY-MM-DD')) AND
                        event_date <= date_trunc('month', to_date('2021-04-01', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' AND
                        vat > 0;




select *,
              CASE
           WHEN full_purchase_date IS NULL THEN full_purchase_date_outbound::text::date
           WHEN full_purchase_date_outbound IS NULL THEN full_purchase_date::text::date
           END                       AS event_date
into table accounter_schema.test3
FROM accounter_schema.isracard_creditcard_transactions;

create index event_date_index on accounter_schema.test3
    ((CASE
           WHEN full_purchase_date IS NULL THEN full_purchase_date_outbound
           WHEN full_purchase_date_outbound IS NULL THEN full_purchase_date
           END) nulls last);


select *
FROM accounter_schema.test3
WHERE (
        (full_payment_date::text::date <= get_creditcard_charge_date('2020-07-01')::date AND
        full_payment_date::text::date > get_creditcard_charge_date_former_month('2020-07-01')::date)
        or
         (
            event_date::text::date >= date_trunc('month', '2020-07-01'::date) AND
            event_date::text::date <= (date_trunc('month', '2020-07-01'::date) + interval '1 month' - interval '1 day')::date
        )
) and
      (full_supplier_name_outbound <> 'TOTAL FOR DATE' OR
       full_supplier_name_outbound IS NULL)
  AND (full_supplier_name_outbound <> 'CASH ADVANCE FEE' OR
       full_supplier_name_outbound IS NULL)
  AND (supplier_name <> 'סך חיוב בש"ח:' OR
       supplier_name IS NULL);






select tax_invoice_date,
       tax_category,
       (CASE
            WHEN currency_id = 'ש"ח' THEN 'ILS'
            WHEN currency_id = 'NIS' THEN 'ILS'
            ELSE currency_id END
           )                         AS currency_code,
       CASE
           WHEN full_purchase_date IS NULL THEN full_purchase_date_outbound::text::date
           WHEN full_purchase_date_outbound IS NULL THEN full_purchase_date::text::date
           END                       AS event_date,
       full_payment_date::text::date AS debit_date,
       CASE
           WHEN payment_sum IS NULL THEN (payment_sum_outbound * -1)
           WHEN payment_sum_outbound IS NULL THEN (payment_sum * -1)
           END                       AS event_amount,
       financial_entity,
       vat,
       user_description,
       tax_invoice_number,
       tax_invoice_amount,
       receipt_invoice_number,
       business_trip,
       personal_category,
       even_with_dotan               AS financial_accounts_to_balance,
       voucher_number                AS bank_reference,
       voucher_number                AS event_number,
       card                          AS account_number,
       'creditcard'                  AS account_type,
       FALSE                         AS is_conversion,
       0                             AS currency_rate,
       null::integer                 as contra_currency_code,
       CASE
           WHEN full_supplier_name_outbound IS NULL THEN full_supplier_name_heb
           WHEN full_supplier_name_heb IS NULL
               THEN (COALESCE(full_supplier_name_outbound, '') || COALESCE('/' || city, ''))
           END                       AS bank_description,
       withholding_tax,
       interest,
       proforma_invoice_file,
       id,
       reviewed,
       hashavshevet_id,
       0                             as current_balance
FROM accounter_schema.isracard_creditcard_transactions
WHERE (
        (full_payment_date::text::date <= get_creditcard_charge_date('2020-07-01')::date AND
        full_payment_date::text::date > get_creditcard_charge_date_former_month('2020-07-01')::date)
        or (full_payment_date is null and (
            full_purchase_date is null and full_purchase_date_outbound::text::date >= date_trunc('month', '2020-07-01'::date) AND
            full_purchase_date_outbound::text::date <= (date_trunc('month', '2020-07-01'::date) + interval '1 month' - interval '1 day')::date)
            or
            full_purchase_date_outbound is null and full_purchase_date::text::date >= date_trunc('month', '2020-07-01'::date) AND
            full_purchase_date::text::date <= (date_trunc('month', '2020-07-01'::date) + interval '1 month' - interval '1 day')::date)
) and
      (full_supplier_name_outbound <> 'TOTAL FOR DATE' OR
       full_supplier_name_outbound IS NULL)
  AND (full_supplier_name_outbound <> 'CASH ADVANCE FEE' OR
       full_supplier_name_outbound IS NULL)
  AND (supplier_name <> 'סך חיוב בש"ח:' OR
       supplier_name IS NULL);



SELECT *
FROM formatted_merged_tables
ORDER BY event_date DESC
LIMIT 250;