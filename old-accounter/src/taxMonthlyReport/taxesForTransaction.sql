uuid_generate_v4();

SELECT
  usd,
  eur
FROM
  accounter_schema.exchange_rates
WHERE
  exchange_date = to_date(date_3, 'YYYY-MM-DD');

SELECT
  *
FROM
  accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
WHERE
  original_id IS NOT NULL;

SELECT
  *
FROM
  accounter_schema.all_transactions
WHERE
  original_id = $$2c384a0f-57b0-454a-a052-1e30cac638d2$$;

CREATE TABLE accounter_schema.ledger AS
SELECT
  *
FROM
  accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
ORDER BY
  to_date(date_3, 'DD/MM/YYYY'),
  original_id;

INSERT INTO
  accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
SELECT
  *
FROM
  get_tax_report_of_transaction('7e81e7c7-6fce-4e6f-8a9f-cccec8185ade') RETURNING *;

SELECT
  * INTO TABLE accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
FROM
  get_tax_report_of_transaction('21b53e78-ef11-4edc-8a68-1e2357d90ca8')
ORDER BY
  to_date(date_3, 'DD/MM/YYYY'),
  original_id;

DROP FUNCTION get_tax_report_of_transaction(transaction_id uuid);

CREATE
OR REPLACE FUNCTION get_tax_report_of_transaction(transaction_id uuid) RETURNS TABLE(
  invoice_date VARCHAR,
  debit_account_1 VARCHAR,
  debit_amount_1 VARCHAR,
  foreign_debit_amount_1 VARCHAR,
  currency VARCHAR,
  credit_account_1 VARCHAR,
  credit_amount_1 VARCHAR,
  foreign_credit_amount_1 VARCHAR,
  debit_account_2 VARCHAR,
  debit_amount_2 VARCHAR,
  foreign_debit_amount_2 VARCHAR,
  credit_account_2 VARCHAR,
  credit_amount_2 VARCHAR,
  foreign_credit_amount_2 VARCHAR,
  details VARCHAR,
  reference_1 BIGINT,
  reference_2 VARCHAR,
  movement_type VARCHAR,
  value_date VARCHAR,
  date_3 VARCHAR,
  original_id uuid,
  origin TEXT,
  proforma_invoice_file TEXT
) LANGUAGE SQL AS $$



WITH this_month_business AS (
SELECT *
FROM formatted_merged_tables
WHERE
    id = transaction_id
), full_report_selection as (
    SELECT
        (CASE
            WHEN side = 0 THEN
                (CASE
                    WHEN (financial_entity = 'Poalim' OR financial_entity = 'Isracard')
                        THEN formatted_event_date
                    ELSE formatted_tax_invoice_date
                END)
            ELSE
                formatted_event_date
        END) AS invoice_date,
        (CASE WHEN event_amount < 0 THEN
            (CASE WHEN side = 0 THEN
                formatted_tax_category
                ELSE formatted_financial_entity
            END) ELSE
            (CASE WHEN side = 0 THEN
                formatted_financial_entity
                ELSE formatted_account
            END)
        END) AS debit_account_1,
        (CASE WHEN event_amount < 0 THEN
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_if_exists
                ELSE formatted_event_amount_in_ils_with_interest
            END) ELSE
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_with_vat_if_exists
                ELSE formatted_event_amount_in_ils
            END)
        END) AS debit_amount_1,
        (CASE
            WHEN side = 0 THEN formatted_invoice_foreign_amount_if_exist
            ELSE formatted_foreign_amount_if_exist
        END) AS foreign_debit_amount_1,
        formatted_currency AS currency,
        (CASE WHEN event_amount < 0 THEN
           (CASE
              WHEN side = 0 THEN formatted_financial_entity
              ELSE formatted_account
           END) ELSE
           (CASE
               WHEN side = 0 THEN formatted_tax_category
               ELSE formatted_financial_entity
           END)
        END) AS credit_account_1,
        (CASE WHEN event_amount > 0 THEN
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_if_exists
                ELSE formatted_event_amount_in_ils_with_interest
            END) ELSE
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_with_vat_if_exists
                ELSE formatted_event_amount_in_ils
            END)
        END) AS credit_amount_1,
        (CASE
            WHEN side = 0 THEN formatted_invoice_foreign_amount_if_exist
            ELSE formatted_foreign_amount_if_exist
        END) AS foreign_credit_amount_1,
        (CASE
            WHEN (side = 0 AND event_amount < 0 AND vat <> 0) THEN 'תשו'
            when (side = 1 and event_amount < 0 and interest <> 0) THEN 'הכנרבמ'
--             ELSE NULL
            END
        ) AS debit_account_2,
        (case
            when currency_code = 'ILS' then
                 (CASE
                    WHEN (side = 0 AND event_amount < 0) THEN (CASE WHEN vat <> 0 THEN to_char(float8 (ABS(
                        (case
                            when tax_category = 'פלאפון' then ((vat::float/3)*2)
                            when tax_category = 'מידע' then ((vat::float/3)*2)
                        else vat
                        end)
                        )), 'FM999999999.00') END)
                    when (side = 1 and event_amount < 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
            else
                (CASE
                    WHEN (side = 0 AND event_amount < 0) THEN
                        (CASE WHEN vat <> 0 THEN
                            to_char(float8 (ABS(formatted_foreign_vat_in_ils)), 'FM999999999.00')
                        END)
                    when (side = 1 and event_amount < 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
        end) AS debit_amount_2,
        to_char(float8 (abs(formatted_foreign_vat)), 'FM999999999.00') AS foreign_debit_amount_2,
        (CASE
            WHEN (side = 0 AND event_amount > 0 AND vat <> 0) THEN 'עסק'
            when (side = 1 and event_amount > 0 and interest <> 0) THEN 'הכנרבמ'
--             ELSE NULL
            END
        ) AS credit_account_2,
        (case
            when currency_code = 'ILS' then
                (CASE
                    WHEN (side = 0 AND event_amount > 0) THEN (CASE WHEN vat <> 0 THEN to_char(float8 (ABS(vat)), 'FM999999999.00') END)
                    when (side = 1 and event_amount > 0 and interest <> 0)
                        then to_char(float8 (ABS(interest)), 'FM999999999.00')
        --             ELSE NULL
                 END)
            else
                (CASE
                    WHEN (side = 0 AND event_amount > 0) THEN
                        (CASE WHEN vat <> 0 THEN
                            to_char(float8 (ABS(formatted_foreign_vat_in_ils)), 'FM999999999.00')
                        END)
                    when (side = 1 and event_amount > 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
        end) AS credit_amount_2,
        to_char(float8 (abs(formatted_foreign_vat)), 'FM999999999.00') AS foreign_credit_amount_2,
        user_description AS details,
        bank_reference AS reference_1,
        RIGHT(regexp_replace(tax_invoice_number, '[^0-9]+', '', 'g'), 9) AS reference_2,
        (CASE
            WHEN side = 0 THEN
                (CASE WHEN event_amount < 0 THEN
                    (CASE
                        WHEN currency_code = 'ILS' THEN
                            (CASE
                                WHEN financial_entity = 'Hot Mobile' THEN 'פלא'
                                WHEN vat <> 0 THEN 'חס'
                                ELSE NULL
                            END)
                        ELSE ''
                    END)
                ELSE
                    (CASE
                        WHEN vat <> 0 THEN 'חל'
                        ELSE 'הכפ'
                    END)
                END)
--             ELSE NULL
            END
        ) AS movement_type,
       (case
           when (tax_invoice_date is not null and account_type != 'creditcard' and side = 0) then formatted_tax_invoice_date
           else (CASE
                    WHEN debit_date IS NULL THEN formatted_event_date
                    ELSE formatted_debit_date
                END)
       end) as value_date,
        formatted_event_date AS date_3,
        formatted_invoice_amount_in_ils_if_exists,
        formatted_event_amount_in_ils,
        formatted_financial_entity,
        event_amount,
        account_type,
        vat,
        tax_invoice_date,
        financial_entity,
        side,
        is_conversion,
        tax_invoice_amount,
        currency_rate,
        personal_category,
        currency_code,
        contra_currency_code,
        debit_date,
        proforma_invoice_file,
        id,
        formatted_tax_category
    FROM this_month_business, generate_series(0,1) as side /* 0 = Entities, 1 = Accounts */
), two_sides as (
    SELECT
        invoice_date,
        debit_account_1,
        debit_amount_1,
        foreign_debit_amount_1,
        currency,
        credit_account_1,
        credit_amount_1,
        foreign_credit_amount_1,
        debit_account_2,
        debit_amount_2,
        foreign_debit_amount_2,
        credit_account_2,
        credit_amount_2,
        foreign_credit_amount_2,
        details,
        reference_1,
        reference_2,
        movement_type,
        value_date,
        date_3,
        id as original_id,
        concat('two_sides - ', side) as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
        financial_entity != 'Isracard' AND
        financial_entity != 'Tax' AND
        financial_entity != 'VAT' AND
        financial_entity != 'Uri Goldshtein Employee Tax Withholding' AND
        financial_entity != 'Uri Goldshtein' AND
        financial_entity != 'Uri Goldshtein Employee Social Security' AND
        financial_entity != 'Tax Corona Grant' AND
        financial_entity != 'Uri Goldshtein Hoz' AND
        formatted_tax_category != 'אוריח' AND
        financial_entity != 'VAT interest refund' AND
        financial_entity != 'Tax Shuma' AND
        is_conversion <> TRUE
), one_side as (
    SELECT
        invoice_date,
        debit_account_1,
        debit_amount_1,
        foreign_debit_amount_1,
        currency,
        credit_account_1,
        credit_amount_1,
        foreign_credit_amount_1,
        debit_account_2,
        debit_amount_2,
        foreign_debit_amount_2,
        credit_account_2,
        credit_amount_2,
        foreign_credit_amount_2,
        details,
        reference_1,
        reference_2,
        movement_type,
        value_date,
        date_3,
        id as original_id,
        concat('one_side - ', side) as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
       (financial_entity = 'Uri Goldshtein' OR
        financial_entity = 'Tax' OR
        financial_entity = 'VAT' OR
        financial_entity = 'Uri Goldshtein Employee Social Security' OR
        financial_entity = 'Isracard' OR
        financial_entity = 'Uri Goldshtein Employee Tax Withholding' OR
        financial_entity = 'Tax Corona Grant' OR
        financial_entity = 'Uri Goldshtein Hoz' or
        formatted_tax_category = 'אוריח' or
        financial_entity = 'VAT interest refund' or
        financial_entity = 'Tax Shuma') AND
       side = 1
), conversions as (
    SELECT
        invoice_date,
        (CASE WHEN event_amount > 0 THEN debit_account_1 END) as debit_account_1,
        (CASE WHEN event_amount > 0 THEN debit_amount_1 END) as debit_amount_1,
        (CASE WHEN event_amount > 0 THEN foreign_debit_amount_1 END) as foreign_debit_amount_1,
        currency,
        (CASE WHEN event_amount < 0 THEN credit_account_1 END) as credit_account_1,
        (CASE WHEN event_amount < 0 THEN credit_amount_1 END) as credit_amount_1,
        (CASE WHEN event_amount < 0 THEN foreign_credit_amount_1 END) as מטח_זכות_חובה_1,
        '' AS debit_account_2,
        '' AS debit_amount_2,
        '' AS foreign_debit_amount_2,
        '' AS credit_account_2,
        '' AS credit_amount_2,
        '' AS foreign_credit_amount_2,
        details,
        reference_1,
        '' AS reference_2,
        '' AS movement_type,
        value_date,
        date_3,
        id as original_id,
        'conversions' as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
         is_conversion IS TRUE AND
         side = 1
), conversions_fees as (
    SELECT
        invoice_date,
        'שער' as debit_account_1,
        to_char(float8 (CASE WHEN event_amount > 0 THEN
            ((
                select credit_amount_1
                from full_report_selection t1
                where
                    t1.is_conversion is true and
                    side = 1 and
                    reference_1 = t1.reference_1 and
                    t1.event_amount < 0
            )::float - debit_amount_1::float)
        END), 'FM999999999.00') as debit_amount_1,
        '' as foreign_debit_amount_1,
        '' as currency,
        '' as credit_account_1,
        '' as credit_amount_1,
        '' as מטח_זכות_חובה_1,
        '' AS debit_account_2,
        '' AS debit_amount_2,
        '' AS foreign_debit_amount_2,
        '' AS credit_account_2,
        '' AS credit_amount_2,
        '' AS foreign_credit_amount_2,
        details,
        reference_1,
        '' AS reference_2,
        '' AS movement_type,
        value_date,
        date_3,
        id as original_id,
        'conversions_fees' as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
         is_conversion IS TRUE AND
         side = 1 and
         event_amount > 0
), invoice_rates_change as (
    SELECT
            invoice_date AS invoice_date,
            'שער' AS debit_account_1,
            to_char(float8 (
                -- TODO: Remove this when we suport currency on invoice_amount
                (case
                    when financial_entity = 'Uri Goldshtein' then tax_invoice_amount::float - formatted_event_amount_in_ils::float
                    when (tax_invoice_amount IS NOT NULL AND tax_invoice_amount <> 0 AND ABS(tax_invoice_amount) <> event_amount)
                        then (formatted_invoice_amount_in_ils_if_exists::float - (CASE
                                        WHEN currency_code = 'EUR' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.eur_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                        WHEN currency_code = 'USD' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.usd_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                    END)
                            ) - formatted_event_amount_in_ils::float
                    else formatted_invoice_amount_in_ils_if_exists::float - formatted_event_amount_in_ils::float
                   end))*-1
                , 'FM999999999.00') as debit_amount_1,
            '' AS foreign_debit_amount_1,
            '' AS currency,
            (case
                when financial_entity = 'Poalim' then ''
                else formatted_financial_entity
            end) AS credit_account_1,
            (case
                when financial_entity = 'Poalim' then ''
                else to_char(float8 (
                    (case
                    when financial_entity = 'Uri Goldshtein' then tax_invoice_amount::float - formatted_event_amount_in_ils::float

                    when (tax_invoice_amount IS NOT NULL AND tax_invoice_amount <> 0 AND ABS(tax_invoice_amount) <> event_amount)

                        then (formatted_invoice_amount_in_ils_if_exists::float - (CASE
                                        WHEN currency_code = 'EUR' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.eur_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                        WHEN currency_code = 'USD' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.usd_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                    END)
                            ) - formatted_event_amount_in_ils::float


                    else formatted_invoice_amount_in_ils_if_exists::float - formatted_event_amount_in_ils::float
                   end)
                    )*-1, 'FM999999999.00')
            end) as credit_amount_1,
            '' AS foreign_credit_amount_1,
            '' AS debit_account_2,
            '' AS debit_amount_2,
            '' AS foreign_debit_amount_2,
            '' AS credit_account_2,
            '' AS credit_amount_2,
            '' AS foreign_credit_amount_2,
            details AS details,
            reference_1 AS reference_1,
            reference_2 AS reference_2,
            '' AS movement_type,
           value_date AS value_date,
           date_3 AS date_3,
           id as original_id,
           'invoice_rates_change' as origin,
           proforma_invoice_file
    FROM full_report_selection
    WHERE
         (
         (tax_invoice_date <> debit_date and
        (select all_exchange_dates.usd_rate
         from all_exchange_dates
         where all_exchange_dates.exchange_date = debit_date::text::date) <> (
         select all_exchange_dates.usd_rate
         from all_exchange_dates
         where all_exchange_dates.exchange_date = tax_invoice_date::text::date))
         or
          (
            financial_entity = 'Uri Goldshtein' and
            (tax_invoice_amount::float - formatted_event_amount_in_ils::float) <> 0
          )
         ) and
         account_type != 'creditcard' and
         currency_code != 'ILS' and
         side = 0
), transfer_fees as (
    SELECT
            formatted_event_date AS invoice_date,
            'עמל' AS debit_account_1,
            to_char(float8 (CASE
                WHEN currency_code = 'EUR' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
            END), 'FM999999999.00') AS debit_amount_1,
            to_char(float8 (ABS(tax_invoice_amount) - event_amount), 'FM999999999.00') AS foreign_debit_amount_1,
            formatted_currency AS currency,
            financial_entity AS credit_account_1,
            to_char(float8 (CASE
                WHEN currency_code = 'EUR' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
            END), 'FM999999999.00') AS credit_amount_1,
            to_char(float8 (ABS(tax_invoice_amount) - event_amount), 'FM999999999.00') AS foreign_credit_amount_1,
            '' AS debit_account_2,
            '' AS debit_amount_2,
            '' AS foreign_debit_amount_2,
            '' AS credit_account_2,
            '' AS credit_amount_2,
            '' AS foreign_credit_amount_2,
            user_description AS details,
            bank_reference AS reference_1,
            '' AS reference_2,
            '' AS movement_type,
           formatted_debit_date AS value_date,
           formatted_event_date AS date_3,
           id as original_id,
           'transfer_fees' as origin,
           proforma_invoice_file
    FROM this_month_business
    WHERE
         tax_invoice_amount IS NOT NULL AND
         tax_invoice_amount <> 0 AND
         ABS(tax_invoice_amount) <> event_amount AND
         currency_code != 'ILS' and
         financial_entity != 'Uri Goldshtein' -- TODO: Until handling tax invoice currency
), withholding_tax as (
    SELECT
            formatted_event_date AS invoice_date,
            'ניבמלק' AS debit_account_1,
            to_char(float8 (ABS(tax_invoice_amount + COALESCE(vat, 0)) - event_amount), 'FM999999999.00') AS debit_amount_1,
            null,
            formatted_currency AS currency,
            financial_entity AS credit_account_1,
            to_char(float8 (ABS(tax_invoice_amount + COALESCE(vat, 0)) - event_amount), 'FM999999999.00') AS credit_amount_1,
            null AS foreign_credit_amount_1,
            '' AS debit_account_2,
            '' AS debit_amount_2,
            '' AS foreign_debit_amount_2,
            '' AS credit_account_2,
            '' AS credit_amount_2,
            '' AS foreign_credit_amount_2,
            user_description AS details,
            bank_reference AS reference_1,
            tax_invoice_number AS reference_2,
            '' AS movement_type,
           formatted_debit_date AS value_date,
           formatted_event_date AS date_3,
           id as original_id,
           'withholding_tax' as origin,
           proforma_invoice_file
    FROM this_month_business
    WHERE
         tax_invoice_amount IS NOT NULL AND
         tax_invoice_amount <> 0 AND
         ABS(tax_invoice_amount) <> event_amount AND
         withholding_tax IS NOT NULL
), all_reports as (
    SELECT * FROM two_sides
    UNION ALL
    SELECT * FROM one_side
    UNION ALL
    SELECT * FROM invoice_rates_change
    UNION ALL
    SELECT * FROM conversions
    UNION ALL
    SELECT * FROM conversions_fees
    UNION ALL
    SELECT * FROM transfer_fees
    UNION ALL
    SELECT * FROM withholding_tax
), checking_asmachta2 as (
    SELECT
           reference_2,
           details,
           *
    FROM full_report_selection
    WHERE
        personal_category <> 'conversion' AND
        financial_entity <> 'Isracard' AND
        financial_entity <> 'Uri Goldshtein' AND
        financial_entity <> 'Poalim' AND
        reference_2 IS NULL
)
SELECT *
FROM all_reports
ORDER BY to_date(invoice_date, 'DD/MM/YYYY'), reference_1 desc, reference_2 desc, debit_amount_1 desc, debit_account_1 desc;



$$;