WITH times_table AS (
    SELECT date_trunc('day', generate_series
        ( min(exchange_date)--'2018-02-15'::timestamp
        , (
            select event_date
            from accounter_schema.future_transactions
            order by event_date desc limit 1
          )::timestamp
--         ,now()::timestamp
        , '1 day'::interval))::date dt
    FROM accounter_schema.exchange_rates
), all_exchange_dates as (
    select dt AS     exchange_date,
           (select t1.eur
            from accounter_schema.exchange_rates t1
            where date_trunc('day', t1.exchange_date)::date <= times_table.dt
            order by t1.exchange_date desc
            limit 1) eur_rate,
           (select t1.usd
            from accounter_schema.exchange_rates t1
            where date_trunc('day', t1.exchange_date)::date <= times_table.dt
            order by t1.exchange_date desc
            limit 1) usd_rate
    from times_table
    order by dt
), formatted_merged_tables AS (
    SELECT *,
           (CASE
             WHEN account_type = 'checking_ils' THEN 'עוש'
             WHEN account_type = 'checking_usd' THEN 'עוש1'
             WHEN account_type = 'checking_eur' THEN 'עוש2'
             WHEN account_type = 'creditcard' THEN 'כא'
             ELSE 'unknown account!!'
           END) as formatted_account,
           (CASE
             WHEN financial_entity = 'Hot Mobile' THEN 'הוט'
             WHEN financial_entity = 'Dotan Simha' THEN 'דותן'
             WHEN financial_entity = 'Kamil Kisiela' THEN 'Kamil'
             WHEN financial_entity = 'MapMe' THEN 'מאפלאבס'
             WHEN financial_entity = 'Isracard' THEN 'כא'
             WHEN financial_entity = 'Poalim' THEN 'עמל'
             WHEN financial_entity = 'Tax' THEN 'מקדמות19'
             WHEN financial_entity = 'Uri Goldshtein Employee Social Security' THEN 'בלני'
             WHEN financial_entity = 'Uri Goldshtein' THEN 'אורי'
             WHEN financial_entity = 'Raveh Ravid & Co' THEN 'יהל'
             ELSE financial_entity END
           ) as formatted_financial_entity,
           to_char(event_date, 'DD/MM/YYYY') as formatted_event_date,
           to_char(tax_invoice_date, 'DD/MM/YYYY') as formatted_tax_invoice_date,
           to_char(debit_date, 'DD/MM/YYYY') as formatted_debit_date,
           (CASE
                WHEN currency_code = 'ILS' THEN event_amount / (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'EUR' THEN event_amount / (
                    (
                        select all_exchange_dates.eur_rate
                        from all_exchange_dates
                        where all_exchange_dates.exchange_date = debit_date::text::date
                    ) / (
                        select all_exchange_dates.usd_rate
                        from all_exchange_dates
                        where all_exchange_dates.exchange_date = debit_date::text::date
                    )
                )
                WHEN currency_code = 'USD' THEN event_amount
                ELSE -99999999999
                END
            ) as event_amount_in_usd,
           (CASE
                WHEN currency_code = 'ILS' THEN (event_amount + COALESCE(vat, 0)) / (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'EUR' THEN event_amount / (
                    (
                        select all_exchange_dates.eur_rate
                        from all_exchange_dates
                        where all_exchange_dates.exchange_date = debit_date::text::date
                    ) / (
                        select all_exchange_dates.usd_rate
                        from all_exchange_dates
                        where all_exchange_dates.exchange_date = debit_date::text::date
                    )
                )
                WHEN currency_code = 'USD' THEN event_amount
                ELSE -99999999999
                END
            ) as event_amount_in_usd_with_vat_if_exists,
           to_char(float8 (ABS((CASE
                WHEN currency_code = 'ILS' THEN event_amount
                WHEN currency_code = 'EUR' THEN event_amount * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN event_amount * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                ELSE -99999999999
                END
            ))), 'FM999999999.00') as formatted_event_amount_in_ils,
           to_char(float8 (ABS((CASE
                WHEN (tax_invoice_amount IS NOT NULL AND
                      tax_invoice_amount <> 0 AND
                      ABS(tax_invoice_amount) <> event_amount)
                    THEN tax_invoice_amount
                ELSE event_amount
            END))), 'FM999999999.00') as formatted_invoice_amount_if_exists,
           to_char(float8 (ABS((CASE
                WHEN currency_code = 'ILS' THEN
                    (CASE
                        WHEN (tax_invoice_amount IS NOT NULL AND
                              tax_invoice_amount <> 0 AND
                              ABS(tax_invoice_amount) <> event_amount)
                            THEN tax_invoice_amount
                        ELSE (event_amount + COALESCE(vat, 0))
                    END)
                WHEN currency_code = 'EUR' THEN (CASE
                        WHEN (tax_invoice_amount IS NOT NULL AND
                              tax_invoice_amount <> 0 AND
                              ABS(tax_invoice_amount) <> event_amount)
                            THEN tax_invoice_amount
                        ELSE event_amount
                    END) * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN (CASE
                        WHEN (tax_invoice_amount IS NOT NULL AND
                              tax_invoice_amount <> 0 AND
                              ABS(tax_invoice_amount) <> event_amount)
                            THEN tax_invoice_amount
                        ELSE event_amount
                    END) * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                ELSE -99999999999
                END
            ))), 'FM999999999.00') as formatted_invoice_amount_in_ils_with_vat_if_exists,
           to_char(float8 (ABS((CASE
                WHEN currency_code = 'ILS' THEN
                    (CASE
                        WHEN (tax_invoice_amount IS NOT NULL AND
                              tax_invoice_amount <> 0 AND
                              ABS(tax_invoice_amount) <> event_amount)
                            THEN tax_invoice_amount
                        ELSE event_amount
                    END)
                WHEN currency_code = 'EUR' THEN (CASE
                        WHEN (tax_invoice_amount IS NOT NULL AND
                              tax_invoice_amount <> 0 AND
                              ABS(tax_invoice_amount) <> event_amount)
                            THEN tax_invoice_amount
                        ELSE event_amount
                    END) * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN (CASE
                        WHEN (tax_invoice_amount IS NOT NULL AND
                              tax_invoice_amount <> 0 AND
                              ABS(tax_invoice_amount) <> event_amount)
                            THEN tax_invoice_amount
                        ELSE event_amount
                    END) * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                ELSE -99999999999
                END
            ))), 'FM999999999.00') as formatted_invoice_amount_in_ils_if_exists,
           to_char(float8 (ABS((CASE
                WHEN currency_code = 'ILS' THEN (event_amount + COALESCE(vat, 0))
                WHEN currency_code = 'EUR' THEN event_amount * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN event_amount * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                ELSE -99999999999
                END
            ))), 'FM999999999.00') as formatted_event_amount_in_ils_with_vat_if_exist,
            to_char(float8 (CASE
                WHEN currency_code != 'ILS' THEN ABS(event_amount)
--                 ELSE NULL
            END), 'FM999999999.00') as formatted_foreign_amount_if_exist,
            to_char(float8 (CASE
                WHEN currency_code != 'ILS' THEN ABS((CASE
                        WHEN (tax_invoice_amount IS NOT NULL AND
                              tax_invoice_amount <> 0 AND
                              ABS(tax_invoice_amount) <> event_amount)
                            THEN tax_invoice_amount
                        ELSE event_amount
                    END))
--                 ELSE NULL
            END), 'FM999999999.00') as formatted_invoice_foreign_amount_if_exist,
            (CASE
                WHEN currency_code = 'USD' THEN '$'
                WHEN currency_code = 'EUR' THEN 'אירו'
                ELSE ''
            END) as formatted_currency
    FROM merged_tables
), this_month_business AS (
SELECT *
FROM formatted_merged_tables
WHERE
    business_trip IS NULL AND
    (account_number = 2733 OR account_number = 61066) AND
        (((financial_entity != 'Isracard' OR financial_entity IS NULL) AND
            account_type != 'creditcard' AND
            event_date::text::date >= '2019-12-01' AND
            event_date::text::date <= '2019-12-31' OR
            event_date IS NULL)
        OR (
            (account_type = 'creditcard' OR financial_entity = 'Isracard') AND
             (
                   debit_date::text::date <= '2020-01-02' AND debit_date::text::date > '2019-12-02' OR
                   (debit_date IS NULL AND event_date::text::date >= '2019-12-01' AND
                    event_date::text::date <= '2019-12-31')
             )))
), business_account AS (
SELECT *
FROM formatted_merged_tables
WHERE
    (account_number = 1082 OR account_number = 466803 OR account_number = 1074) AND
        (((financial_entity != 'Isracard' OR financial_entity IS NULL) AND
            account_type != 'creditcard' AND
            event_date::text::date >= '2019-12-01' AND
            event_date::text::date <= '2019-12-31' OR
            event_date IS NULL)
        OR (
            (account_type = 'creditcard' OR financial_entity = 'Isracard') AND
             (
                   debit_date::text::date <= '2020-01-02' AND debit_date::text::date > '2019-12-02' OR
                   (debit_date IS NULL AND event_date::text::date >= '2019-12-01' AND
                    event_date::text::date <= '2019-12-31')
             )))
), this_month_private_creditcard AS (
SELECT
    event_date,
    SUM(event_amount_in_usd_with_vat_if_exists) OVER (ORDER BY event_date, event_number) as sum_till_this_point,
    event_number
FROM formatted_merged_tables
WHERE
    account_type = 'creditcard' AND
    account_number = 6264 AND
    debit_date > now()
), this_month_business_creditcard AS (
SELECT
    event_date,
    SUM(event_amount_in_usd_with_vat_if_exists) OVER (ORDER BY event_date, event_number) as sum_till_this_point,
    event_number
FROM formatted_merged_tables
WHERE
    account_type = 'creditcard' AND
    account_number = 2733 AND
    debit_date > now()
ORDER BY event_date, event_number
), creditcard_all_balances AS (
SELECT
    event_date,
    SUM(event_amount::numeric) OVER (ORDER BY event_date, event_number) as sum_till_this_point,
    debit_date,
    event_number
FROM formatted_merged_tables
WHERE
    account_type = 'creditcard' AND
    account_number = 2733 AND
    debit_date::text::date = '2018-09-02'::text::date AND
    currency_code = 'ILS'
ORDER BY event_date, event_number
), creditcard_all_balance_charges AS (
SELECT
    event_date,
    bank_reference,
    event_amount,
    user_description,
    SUM(formatted_event_amount_in_ils::numeric) OVER (ORDER BY event_date, event_number) as sum_till_this_point,
    event_number
FROM formatted_merged_tables
WHERE
    account_type != 'creditcard' AND
    account_number = 61066 AND
    financial_entity = 'Isracard' AND
    debit_date::text::date = '2018-09-02'::text::date
ORDER BY event_date, event_number
), deposits AS (
    select
           amount,
           validity_date
    from accounter_schema.poalim_deposits_account_transactions
    order by validity_date
), dotan_dept AS (
    SELECT
        event_date,
        event_amount,
        currency_code,
        event_amount_in_usd_with_vat_if_exists,
        SUM((event_amount_in_usd_with_vat_if_exists / 2) * -1)
        OVER (ORDER BY event_date, event_number, event_amount, bank_reference, account_number) as sum_till_this_point,
        bank_reference,
        account_number,
        event_number,
        user_description
    FROM formatted_merged_tables
    WHERE
          (account_number = 2733 OR account_number = 61066)
          AND event_date::date >= '2019-12-01'::timestamp
          AND financial_accounts_to_balance = 'no'
    ORDER BY event_date, event_number, event_amount, bank_reference, account_number
), dotan_anti_dept AS (
    SELECT
        event_date,
        event_amount,
        currency_code,
        event_amount_in_usd_with_vat_if_exists,
        SUM(event_amount_in_usd_with_vat_if_exists * -1)
        OVER (ORDER BY event_date, event_number, event_amount, bank_reference, account_number) as sum_till_this_point,
        bank_reference,
        account_number,
        event_number,
        user_description
    FROM formatted_merged_tables
    WHERE
          (account_number = 2733 OR account_number = 61066)
          AND event_date::date >= '2019-12-31'::timestamp
          AND financial_entity = 'Dotan Simha'
    ORDER BY event_date, event_number, event_amount, bank_reference, account_number
), dotan_future_dept AS (
    SELECT
        event_date,
        event_amount,
        currency_code,
        financial_entity,
        user_description,
        SUM((
            (CASE
                WHEN currency_code = 'ILS' THEN (event_amount / (
                        select all_exchange_dates.usd_rate
                        from all_exchange_dates
                        order by all_exchange_dates.exchange_date desc limit 1
                ))
                WHEN currency_code = 'EUR' THEN event_amount / (
                    (
                        select all_exchange_dates.eur_rate
                        from all_exchange_dates
                        order by all_exchange_dates.exchange_date desc limit 1
                    ) / (
                        select all_exchange_dates.usd_rate
                        from all_exchange_dates
                        order by all_exchange_dates.exchange_date desc limit 1
                    )
                )
                WHEN currency_code = 'USD' THEN event_amount
                ELSE -99999999999
            END)/2)*-1)
            OVER (ORDER BY event_date, event_amount, user_description, account_number) as sum_till_this_point
    FROM accounter_schema.future_transactions
    WHERE
        (account_number = 2733 OR account_number = 61066) AND
        event_date::date >= '2019-12-01'::timestamp AND
        financial_accounts_to_balance = 'no'
    ORDER BY event_date, event_amount, user_description, account_number
), new_business_account_transactions AS (
SELECT
    event_date,
    event_amount,
    currency_code,
    event_amount_in_usd_with_vat_if_exists,
    SUM(event_amount_in_usd_with_vat_if_exists / 2)
    OVER (ORDER BY event_date, event_number, event_amount, bank_reference, account_number) as sum_till_this_point,
    bank_reference,
    account_number,
    event_number,
    user_description
FROM formatted_merged_tables
WHERE
      (account_number = 1082 OR account_number = 466803 OR account_number = 1074)
      AND event_date::date >= '2019-12-01'::timestamp
      and personal_category <> 'conversion'
      and financial_entity <> 'Isracard'
--           AND financial_accounts_to_balance = 'no'
ORDER BY event_date, event_number, event_amount, bank_reference, account_number
), future_balance AS (
    SELECT
        event_date,
        event_amount,
        currency_code,
        financial_entity,
        user_description,
        SUM(
            (CASE
                WHEN currency_code = 'ILS' THEN (event_amount / (
                        select all_exchange_dates.usd_rate
                        from all_exchange_dates
                        order by all_exchange_dates.exchange_date desc limit 1
                ))
                WHEN currency_code = 'EUR' THEN event_amount / (
                    (
                        select all_exchange_dates.eur_rate
                        from all_exchange_dates
                        order by all_exchange_dates.exchange_date desc limit 1
                    ) / (
                        select all_exchange_dates.usd_rate
                        from all_exchange_dates
                        order by all_exchange_dates.exchange_date desc limit 1
                    )
                )
                WHEN currency_code = 'USD' THEN event_amount
                ELSE -99999999999
            END))
            OVER (ORDER BY event_date, event_amount, user_description, account_number) as sum_till_this_point
    FROM accounter_schema.future_transactions
    WHERE
        (account_number = 2733 OR account_number = 61066) AND
        event_date::date >= '2019-12-01'::timestamp
    ORDER BY event_date, event_amount, user_description, account_number
), current_vat_transactions_status AS (
    SELECT
       event_date, event_amount, bank_reference, account_number,
       SUM(vat::numeric(9,2)) OVER (ORDER BY event_date, event_amount, bank_reference, account_number) as sum_vat
    FROM formatted_merged_tables
    WHERE
        (account_number = 2733 OR account_number = 61066) AND
          event_date::text::date >= '2019-01-01'
--        AND event_date::text::date <= '2019-12-31'
          OR event_date IS NULL
    ORDER BY event_date, event_amount, bank_reference, account_number
), all_vat_payments AS (
    SELECT
       event_date, event_amount, bank_reference, account_number,
       SUM(event_amount::numeric(9,2)) OVER (ORDER BY event_date, event_amount, bank_reference, account_number) as sum_all_vat
    FROM formatted_merged_tables
    WHERE
        financial_entity = 'VAT' AND
        (account_number = 2733 OR account_number = 61066) AND
          event_date::text::date >= '2019-01-01'
--        AND event_date::text::date <= '2019-12-31'
          OR event_date IS NULL
    ORDER BY event_date, event_amount, bank_reference, account_number
), current_vat_status AS (
    SELECT
       event_date, event_amount, bank_reference, account_number,
       SUM((CASE WHEN financial_entity = 'VAT' THEN (event_amount*-1)
            ELSE (vat) END)::numeric(9,2))
           OVER (ORDER BY event_date, event_amount, bank_reference, account_number)
           as VAT_status
    FROM formatted_merged_tables
    WHERE
        (account_number = 2733 OR account_number = 61066) AND
        (vat IS NOT NULL AND vat <> 0 OR financial_entity = 'VAT') AND
          event_date::text::date >= '2019-01-01'
--        AND event_date::text::date <= '2019-12-31'
          OR event_date IS NULL
    ORDER BY event_date, event_amount, bank_reference, account_number
), all_vat_transactions AS (
    SELECT
       vat,
       user_description,
       event_date
    FROM formatted_merged_tables
    WHERE
      vat IS NOT NULL AND
      vat <> 0 AND
      (account_number = 2733 OR account_number = 61066) AND
          event_date::text::date >= '2019-01-01'
--           AND event_date::text::date <= '2019-12-31'
          OR event_date IS NULL
), top_income_all_time AS (
SELECT
       SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9,2),
       financial_entity
    FROM formatted_merged_tables
    WHERE
        business_trip IS NULL AND
        (account_number = 2733 OR account_number = 61066) AND
        personal_category <> 'conversion' AND
        financial_entity <> 'Uri Goldshtein' AND
        financial_entity <> 'Tax' AND
        financial_entity <> 'VAT' AND
        financial_entity <> 'Dotan Simha' AND
        financial_entity <> 'Isracard' AND
        event_amount IS NOT NULL AND
        event_amount > 0
    --       event_date::text::date >= '2019-12-01' AND
    --       event_date::text::date <= '2019-12-31' OR
    --       event_date IS NULL
    GROUP BY financial_entity
    ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9,2) DESC NULLS LAST
), top_expense_all_time AS (
SELECT
       ABS(SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9,2)),
       financial_entity
    FROM formatted_merged_tables
    WHERE
        business_trip IS NULL AND
        (account_number = 2733 OR account_number = 61066) AND
        personal_category <> 'conversion' AND
        financial_entity <> 'Uri Goldshtein' AND
        financial_entity <> 'Tax' AND
        financial_entity <> 'VAT' AND
        financial_entity <> 'Dotan Simha' AND
        financial_entity <> 'Isracard' AND
        event_amount < 0
    --       event_date::text::date >= '2019-12-01' AND
    --       event_date::text::date <= '2019-12-31' OR
    --       event_date IS NULL
    GROUP BY financial_entity
    ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9,2) NULLS LAST
), top_private_expenses AS (
SELECT
       ABS(SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9,2)),
       personal_category
    FROM formatted_merged_tables
    WHERE
        (account_number = 9217 OR account_number = 410915) AND
        personal_category <> 'conversion' AND
        financial_entity <> 'Uri Goldshtein' AND
        financial_entity <> 'Tax' AND
        financial_entity <> 'VAT' AND
        financial_entity <> 'Dotan Simha' AND
        financial_entity <> 'Isracard'
--         AND event_amount < 0
    --       event_date::text::date >= '2019-12-01' AND
    --       event_date::text::date <= '2019-12-31' OR
    --       event_date IS NULL
    GROUP BY personal_category
    ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9,2) NULLS LAST
), top_private_expenses_with_business_account AS (
SELECT
       ABS(SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9,2)),
       personal_category
    FROM formatted_merged_tables
    WHERE
        personal_category <> 'conversion' AND
        personal_category <> 'business' AND
        financial_entity <> 'Uri Goldshtein' AND
        financial_entity <> 'Tax' AND
        financial_entity <> 'VAT' AND
        financial_entity <> 'Dotan Simha' AND
        financial_entity <> 'Isracard'
--         AND event_amount < 0
    --       event_date::text::date >= '2019-12-01' AND
    --       event_date::text::date <= '2019-12-31' OR
    --       event_date IS NULL
    GROUP BY personal_category
    ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9,2) NULLS LAST
), top_private_expenses_not_categorized AS (
SELECT
       ABS(event_amount),
       event_date,
       user_description
    FROM formatted_merged_tables
    WHERE
        (account_number = 9217 OR account_number = 410915) AND
        (personal_category IS NULL OR
         personal_category = '')
--         AND event_amount < 0
    --       event_date::text::date >= '2019-12-01' AND
    --       event_date::text::date <= '2019-12-31' OR
    --       event_date IS NULL
    ORDER BY ABS(event_amount) DESC NULLS LAST
), missing_invoice_dates as (
    SELECT *
    FROM this_month_business
    WHERE tax_invoice_date IS NULL AND
          financial_entity != 'Poalim' AND /*TODO: Check if we can get those invoices */
          financial_entity != 'Isracard'
), missing_invoice_numbers as (
    SELECT *
    FROM this_month_business
    WHERE
          tax_invoice_number IS NULL AND
          financial_entity != 'Poalim' AND /*TODO: Check if we can get those invoices */
          financial_entity != 'Isracard' AND
          financial_entity != 'Uri Goldshtein Employee Social Security' AND
          financial_entity != 'Uri Goldshtein'
), missing_receipts_numbers as (
    SELECT *
    FROM this_month_business
    WHERE
          receipt_invoice_number IS NULL AND
          financial_entity != 'Poalim' AND /*TODO: Check if we can get those invoices */
          financial_entity != 'Isracard' AND
          financial_entity != 'Uri Goldshtein Employee Social Security' AND
          financial_entity != 'Uri Goldshtein'
), acending_invoice_numbers as (
    SELECT tax_invoice_number,
           user_description,
           financial_entity,
           event_amount,
           event_date
    FROM formatted_merged_tables
    WHERE
          (account_number = 2733 OR account_number = 61066) AND
          event_amount > 0 AND
          financial_entity != 'Poalim' AND
          financial_entity != 'VAT' AND
          financial_entity != 'Uri Goldshtein' AND
          financial_entity != 'Isracard'
    ORDER BY tax_invoice_number DESC NULLS LAST
), ils_business_balance as (
    SELECT DISTINCT on (event_date) event_date,
                                    current_balance,
                                    account_number
    FROM accounter_schema.poalim_ils_account_transactions
    WHERE account_number = 61066
    ORDER BY event_date,
             expanded_event_date DESC
), ils_personal_balance as (

    SELECT DISTINCT on (event_date) event_date,
                                    current_balance,
                                    account_number
    FROM accounter_schema.poalim_ils_account_transactions
    WHERE account_number = 410915
    ORDER BY event_date,
             expanded_event_date DESC

), usd_business_balance as (
    SELECT DISTINCT on (executing_date) executing_date,
                                        current_balance,
                                        account_number
    FROM accounter_schema.poalim_usd_account_transactions
    WHERE account_number = 61066
    ORDER BY executing_date,
             event_number DESC
), usd_personal_balance as (
    SELECT DISTINCT on (executing_date) executing_date,
                                        current_balance,
                                        account_number
    FROM accounter_schema.poalim_usd_account_transactions
    WHERE account_number = 410915
    ORDER BY executing_date,
             event_number DESC
),euro_business_balance as (
    SELECT DISTINCT on (executing_date) executing_date,
                                        current_balance,
                                        account_number
    FROM accounter_schema.poalim_eur_account_transactions
    WHERE account_number = 61066
    ORDER BY executing_date,
             event_number DESC
), euro_personal_balance as (
    SELECT DISTINCT on (executing_date) executing_date,
                                        current_balance,
                                        account_number
    FROM accounter_schema.poalim_eur_account_transactions
    WHERE account_number = 410915
    ORDER BY executing_date,
             event_number DESC
), all_balances as (
    select dt,
           (select t1.current_balance
            from ils_business_balance t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by event_date desc
            limit 1) ils_business_balance,
           (select t1.current_balance
            from ils_personal_balance t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by event_date desc
            limit 1) ils_personal_balance,
           (select t1.current_balance
            from usd_business_balance t1
            where date_trunc('day', t1.executing_date)::date <= times_table.dt
            order by executing_date desc
            limit 1) usd_business_balance,
           (select t1.current_balance
            from usd_personal_balance t1
            where date_trunc('day', t1.executing_date)::date <= times_table.dt
            order by executing_date desc
            limit 1) usd_personal_balance,
           (select t1.current_balance
            from euro_business_balance t1
            where date_trunc('day', t1.executing_date)::date <= times_table.dt
            order by executing_date desc
            limit 1) eur_business_balance,
           (select t1.current_balance
            from euro_personal_balance t1
            where date_trunc('day', t1.executing_date)::date <= times_table.dt
            order by executing_date desc
            limit 1) eur_personal_balance,
           (select t1.eur
            from accounter_schema.exchange_rates t1
            where date_trunc('day', t1.exchange_date)::date <= times_table.dt
            order by t1.exchange_date desc
            limit 1) eur_rate,
           (select t1.usd
            from accounter_schema.exchange_rates t1
            where date_trunc('day', t1.exchange_date)::date <= times_table.dt
            order by t1.exchange_date desc
            limit 1) usd_rate,
           (select t1.amount
            from accounter_schema.dotan_debt t1
            where date_trunc('day', t1.debt_date)::date <= times_table.dt
            order by t1.debt_date desc
            limit 1) dotan_old_dept,
           (select t1.sum_till_this_point
            from dotan_dept t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, t1.event_number desc, t1.event_amount, t1.bank_reference, t1.account_number
            limit 1) dotan_dept,
           (select t1.sum_till_this_point
            from dotan_anti_dept t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, t1.event_number desc, t1.event_amount, t1.bank_reference, t1.account_number
            limit 1) dotan_anti_dept,
           (select t1.sum_till_this_point
            from new_business_account_transactions t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, t1.event_number desc, t1.event_amount, t1.bank_reference, t1.account_number
            limit 1) new_business_account_transactions,
            (select t1.amount
            from deposits t1
            where date_trunc('day', t1.validity_date)::date <= times_table.dt
            order by t1.validity_date desc
            limit 1) deposits,
           (select t1.user_description
            from dotan_dept t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, t1.event_number desc, t1.event_amount, t1.bank_reference, t1.account_number
            limit 1) dotan_event,
           (select t1.VAT_status
            from current_vat_status t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, t1.bank_reference desc
            limit 1) VAT,
           (select t1.sum_till_this_point
            from this_month_private_creditcard t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, t1.event_number desc
            limit 1) this_month_private_creditcard,
           (select t1.sum_till_this_point
            from this_month_business_creditcard t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, t1.event_number desc
            limit 1) this_month_business_creditcard,
           (select t1.sum_till_this_point
            from future_balance t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, user_description desc
            limit 1) future_transactions,
           (select t1.sum_till_this_point
            from dotan_future_dept t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, user_description desc
            limit 1) dotan_future_dept
    from times_table
    order by dt
), dotan_future_dept_in_days as (
select
       dt, (
        select t1.sum_till_this_point
        from   dotan_future_dept t1
        where    date_trunc('day', t1.event_date)::date <= times_table.dt
        order by t1.event_date desc, user_description desc
        limit 1
        ) dotan_dept
from times_table
order by dt
), dotan_dept_in_days as (
select
        event_date,
        sum_till_this_point,
        user_description,
        event_amount,
        currency_code
from dotan_dept
order by event_date desc
), caluculated_values as (
    select dt,
           ils_business_balance,
           usd_business_balance,
           eur_business_balance,
           (ils_business_balance / usd_rate)            as ils_business_in_usd,
           (eur_business_balance / (eur_rate/usd_rate)) as eur_business_in_usd,
           this_month_business_creditcard,
           ils_personal_balance,
           usd_personal_balance,
           eur_personal_balance,
           (ils_personal_balance / usd_rate)            as ils_personal_in_usd,
           (eur_personal_balance / (eur_rate/usd_rate)) as eur_personal_in_usd,
           this_month_private_creditcard,
           (dotan_old_dept / usd_rate)                      as dotan_old_dept,
           dotan_dept,
           dotan_anti_dept,
           new_business_account_transactions,
           ((deposits / usd_rate) / 2) as deposits,
           (VAT / usd_rate) as VAT,
           future_transactions,
           dotan_future_dept
    from all_balances
), all_balances_till_today as (
    select dt,
           ils_business_balance,
           ils_business_in_usd,
           dotan_old_dept,
           dotan_dept,
           dotan_anti_dept,
           new_business_account_transactions,
           VAT,
           this_month_business_creditcard,
           this_month_private_creditcard,
           future_transactions,
           dotan_future_dept,
           usd_business_balance,
           eur_business_balance,
           eur_business_in_usd,
           deposits,
           (
                   COALESCE(ils_business_in_usd, 0) +
                   COALESCE(usd_business_balance, 0) +
                   COALESCE(eur_business_in_usd, 0) +
                   COALESCE(this_month_business_creditcard, 0) +
                   COALESCE(new_business_account_transactions, 0) +
                   COALESCE(deposits, 0)
               ) as all_business_accounts,
           (
                           COALESCE(ils_business_in_usd, 0) +
                           COALESCE(usd_business_balance, 0) +
                           COALESCE(eur_business_in_usd, 0) -
                           COALESCE(dotan_old_dept, 0) +
                           COALESCE(dotan_dept, 0) +
                           COALESCE(dotan_anti_dept, 0) +
                           COALESCE(VAT, 0) +
                           COALESCE(this_month_business_creditcard, 0) +
                           COALESCE(future_transactions, 0) +
                           COALESCE(dotan_future_dept, 0) +
                           COALESCE(new_business_account_transactions, 0) +
                           COALESCE(deposits, 0)
               ) as everything_business,
           ils_personal_balance,
           ils_personal_in_usd,
           usd_personal_balance,
           eur_personal_balance,
           eur_personal_in_usd,
           (
                   COALESCE(ils_personal_in_usd, 0) +
                   COALESCE(usd_personal_balance, 0) +
                   COALESCE(eur_personal_in_usd, 0) +
                   COALESCE(this_month_private_creditcard, 0)
               ) as everything_personal,
           (
                           COALESCE(ils_business_in_usd, 0) +
                           COALESCE(usd_business_balance, 0) +
                           COALESCE(eur_business_in_usd, 0) -
                           COALESCE(dotan_old_dept, 0) +
                           COALESCE(dotan_dept, 0) +
                           COALESCE(dotan_anti_dept, 0) +
                           COALESCE(VAT, 0) +
                           COALESCE(this_month_business_creditcard, 0) +
                           COALESCE(ils_personal_in_usd, 0) +
                           COALESCE(usd_personal_balance, 0) +
                           COALESCE(eur_personal_in_usd, 0) +
                           COALESCE(this_month_private_creditcard, 0) +
                           COALESCE(future_transactions, 0) +
                           COALESCE(dotan_future_dept, 0) +
                           COALESCE(new_business_account_transactions, 0) +
                           COALESCE(deposits, 0)
               ) as everything
    from caluculated_values
)
SELECT *
FROM all_balances_till_today;
-- from dotan_dept_in_days;

/*
30624.61


-147236.65545976133715118858
-144183.55382157159708855343
creditcard_all_balances
all_creditcard_transactions
merged_tables
all_balances_till_today - All balances of everything
current_vat_status - Running balance of VAT
times_table
all_exchange_dates
formatted_merged_tables
this_month_business
dotan_dept
current_vat_transactions_status
all_vat_payments
current_vat_status
all_vat_transactions
top_income_all_time
top_expense_all_time
top_private_expenses
top_private_expenses_with_business_account
top_private_expenses_not_categorized
missing_invoice_dates
missing_invoice_numbers
missing_receipts_numbers
acending_invoice_numbers
ils_business_balance
ils_personal_balance
usd_business_balance
usd_personal_balance
euro_business_balance
euro_personal_balance
all_balances
caluculated_values
all_balances_till_today
full_report_selection
two_sides
one_side
conversions
transfer_fees
all_vat_for_previous_month
all_vat_to_recieve_for_previous_month
all_vat_to_pay_for_previous_month
all_reports
checking_asmachta2
checking_all_abroad_has_ils
vat_closed_for_this_month
 */