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
), local_formatted_merged_tables AS (
    SELECT *,
           (CASE
                WHEN currency_code = 'ILS' THEN event_amount / (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = coalesce(debit_date::text::date, event_date)
                )
                WHEN currency_code = 'EUR' THEN event_amount * (
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
            WHEN currency_code = 'ILS' THEN (event_amount - COALESCE(vat, 0)) / (
                select all_exchange_dates.usd_rate
                from all_exchange_dates
                where all_exchange_dates.exchange_date = coalesce(debit_date::text::date, event_date)
            )
            WHEN currency_code = 'EUR' THEN (event_amount - COALESCE(vat, 0)) * (
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
            WHEN currency_code = 'USD' THEN event_amount - COALESCE(vat, 0)
                ELSE -99999999999
                END
            ) as event_amount_in_usd_with_vat_if_exists,
   (CASE
        WHEN currency_code = 'ILS' THEN coalesce(vat, 0) / (
            select all_exchange_dates.usd_rate
            from all_exchange_dates
            where all_exchange_dates.exchange_date = coalesce(debit_date::text::date, event_date)
        )
        WHEN currency_code = 'EUR' THEN coalesce(vat, 0) * (
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
        WHEN currency_code = 'USD' THEN coalesce(vat, 0)
        ELSE -99999999999
        END
    ) as event_vat_amount_in_usd
    FROM accounter_schema.all_transactions
), this_month_private_creditcard AS (
SELECT
    event_date,
    SUM(event_amount_in_usd_with_vat_if_exists) OVER (ORDER BY event_date, event_number) as sum_till_this_point,
    event_number
FROM local_formatted_merged_tables
WHERE
    account_type = 'creditcard' AND
    account_number = 6264 AND
    debit_date > now()
), this_month_business_creditcard AS (
SELECT
    event_date,
    SUM(event_amount_in_usd_with_vat_if_exists) OVER (ORDER BY event_date, event_number) as sum_till_this_point,
    event_number
FROM local_formatted_merged_tables
WHERE
    account_type = 'creditcard' AND
    account_number = 2733 AND
    debit_date > now()
ORDER BY event_date, event_number
), dotan_dept AS (
    SELECT
        financial_accounts_to_balance,
        event_date,
        event_amount,
        currency_code,
        event_amount_in_usd,
        event_amount_in_usd_with_vat_if_exists,
        (case
            when financial_accounts_to_balance = 'uri' then 0
            when financial_accounts_to_balance = 'dotan' then event_amount_in_usd_with_vat_if_exists
            when financial_accounts_to_balance = 'deposit' then 0
            when financial_entity = 'VAT' then 0
            else (event_amount_in_usd_with_vat_if_exists / 2)
        end)* -1,
       SUM((case
            when financial_accounts_to_balance = 'uri' then 0
            when financial_accounts_to_balance = 'dotan' then event_amount_in_usd_with_vat_if_exists
            when financial_accounts_to_balance = 'deposit' then 0
            when financial_entity = 'VAT' then 0
            else (event_amount_in_usd_with_vat_if_exists / 2)
        end)* -1) OVER (ORDER BY event_date, event_number, event_amount, bank_reference, account_number) as sum_till_this_point,
        financial_entity,
        user_description,
        bank_reference,
        vat,
        event_vat_amount_in_usd,
        account_number,
        event_number
    FROM local_formatted_merged_tables
    WHERE
          (account_number = 2733 OR account_number = 61066)
          AND event_date::date >= '2019-12-01'::timestamp
          AND financial_accounts_to_balance in ('no', 'dotan', 'uri')
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
                WHEN currency_code = 'EUR' THEN event_amount * (
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
    currency_code,
    event_amount,
    event_amount_in_usd,
    event_amount_in_usd_with_vat_if_exists,
    SUM(case
        when financial_accounts_to_balance = 'uri' then event_amount_in_usd_with_vat_if_exists
        when financial_accounts_to_balance = 'dotan' then 0
        when financial_accounts_to_balance = 'deposit' then 0
        when financial_entity = 'VAT' then 0
        else (event_amount_in_usd_with_vat_if_exists / 2)
    end) OVER (ORDER BY event_date, event_number, event_amount, bank_reference, account_number) as sum_till_this_point,
    SUM(case
        when financial_accounts_to_balance = 'uri' then 0
        when financial_accounts_to_balance = 'dotan' then event_amount_in_usd_with_vat_if_exists
        when financial_accounts_to_balance = 'deposit' then 0
        when financial_entity = 'VAT' then 0
        else (event_amount_in_usd_with_vat_if_exists / 2)
    end) OVER (ORDER BY event_date, event_number, event_amount, bank_reference, account_number) as dotan_sum_till_this_point,
    financial_entity,
    user_description,
    SUM(case when financial_entity = 'VAT' then event_amount_in_usd
        else event_vat_amount_in_usd
        end)  OVER (ORDER BY event_date, event_number, event_amount, bank_reference, account_number) as sum_vat,
    vat,
    event_vat_amount_in_usd,
    bank_reference,
    account_number,
    event_number
FROM local_formatted_merged_tables
WHERE
      (account_number = 1082 OR account_number = 466803 OR account_number = 1074)
      and financial_entity <> 'Isracard'
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
                WHEN currency_code = 'EUR' THEN event_amount * (
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
), current_vat_status AS (
    SELECT
       event_date, vat, event_amount, bank_reference, account_number,
       SUM((CASE WHEN financial_entity = 'VAT' THEN (event_amount_in_usd * -1)
            ELSE (event_vat_amount_in_usd * -1) END)::numeric(9,2))
           OVER (ORDER BY event_date, event_amount, bank_reference, account_number)
           as VAT_status,
       financial_entity
    FROM local_formatted_merged_tables
    WHERE
        (account_number = 2733 OR account_number = 61066) AND
        (vat IS NOT NULL AND vat <> 0 OR financial_entity = 'VAT') AND
          event_date::text::date >= '2019-01-01'
--        AND event_date::text::date <= '2019-12-31'
          OR event_date IS NULL
    ORDER BY event_date, event_amount, bank_reference, account_number
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
            from new_business_account_transactions t1
            where date_trunc('day', t1.event_date)::date <= times_table.dt
            order by t1.event_date desc, t1.event_number desc, t1.event_amount, t1.bank_reference, t1.account_number
            limit 1) new_business_account_transactions,
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
), caluculated_values as (
    select dt,
           ils_business_balance,
           usd_business_balance,
           eur_business_balance,
           (ils_business_balance / usd_rate)            as ils_business_in_usd,
           (eur_business_balance * (eur_rate/usd_rate)) as eur_business_in_usd,
           this_month_business_creditcard,
           ils_personal_balance,
           usd_personal_balance,
           eur_personal_balance,
           (ils_personal_balance / usd_rate)            as ils_personal_in_usd,
           (eur_personal_balance * (eur_rate/usd_rate)) as eur_personal_in_usd,
           this_month_private_creditcard,
           (dotan_old_dept / usd_rate)                      as dotan_old_dept,
           dotan_dept,
           new_business_account_transactions,
           VAT,
           future_transactions,
           dotan_future_dept
    from all_balances
), all_balances_till_today as (
    select dt,
           ils_business_balance,
           ils_business_in_usd,
           dotan_old_dept,
           dotan_dept,
           new_business_account_transactions,
           VAT,
           this_month_business_creditcard,
           this_month_private_creditcard,
           future_transactions,
           dotan_future_dept,
           usd_business_balance,
           eur_business_balance,
           eur_business_in_usd,
           (
                   COALESCE(ils_business_in_usd, 0) +
                   COALESCE(usd_business_balance, 0) +
                   COALESCE(eur_business_in_usd, 0) +
                   COALESCE(this_month_business_creditcard, 0) +
                   COALESCE(new_business_account_transactions, 0)
               ) as all_business_accounts,
           (
                           COALESCE(ils_business_in_usd, 0) +
                           COALESCE(usd_business_balance, 0) +
                           COALESCE(eur_business_in_usd, 0) -
                           COALESCE(dotan_old_dept, 0) +
                           COALESCE(dotan_dept, 0) +
                           COALESCE(VAT, 0) +
                           COALESCE(this_month_business_creditcard, 0) +
                           COALESCE(future_transactions, 0) +
                           COALESCE(dotan_future_dept, 0) +
                           COALESCE(new_business_account_transactions, 0)
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
                           COALESCE(VAT, 0) +
                           COALESCE(this_month_business_creditcard, 0) +
                           COALESCE(ils_personal_in_usd, 0) +
                           COALESCE(usd_personal_balance, 0) +
                           COALESCE(eur_personal_in_usd, 0) +
                           COALESCE(this_month_private_creditcard, 0) +
                           COALESCE(future_transactions, 0) +
                           COALESCE(dotan_future_dept, 0) +
                           COALESCE(new_business_account_transactions, 0)
               ) as everything
    from caluculated_values
)
SELECT *
FROM all_balances_till_today;