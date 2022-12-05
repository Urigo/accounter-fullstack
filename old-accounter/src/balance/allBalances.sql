WITH
  times_table AS (
    SELECT
      date_trunc(
        'day',
        generate_series(
          min(exchange_date) --'2018-02-15'::timestamp
,
          (
            SELECT
              event_date
            FROM
              accounter_schema.future_transactions
            ORDER BY
              event_date DESC
            LIMIT
              1
          )::TIMESTAMP --         ,now()::timestamp
,
          '1 day'::INTERVAL
        )
      )::date dt
    FROM
      accounter_schema.exchange_rates
  ),
  all_exchange_dates AS (
    SELECT
      dt AS exchange_date,
      (
        SELECT
          t1.eur
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          date_trunc('day', t1.exchange_date)::date <= times_table.dt
        ORDER BY
          t1.exchange_date DESC
        LIMIT
          1
      ) eur_rate,
      (
        SELECT
          t1.usd
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          date_trunc('day', t1.exchange_date)::date <= times_table.dt
        ORDER BY
          t1.exchange_date DESC
        LIMIT
          1
      ) usd_rate,
      (
        SELECT
          t1.gbp
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          date_trunc('day', t1.exchange_date)::date <= times_table.dt
        ORDER BY
          t1.exchange_date DESC
        LIMIT
          1
      ) gbp_rate
    FROM
      times_table
    ORDER BY
      dt
  ),
  local_formatted_merged_tables AS (
    SELECT
      *,
      (
        CASE
          WHEN currency_code = 'ILS' THEN event_amount / (
            SELECT
              all_exchange_dates.usd_rate
            FROM
              all_exchange_dates
            WHERE
              all_exchange_dates.exchange_date = COALESCE(debit_date::TEXT::date, event_date)
          )
          WHEN currency_code = 'EUR' THEN event_amount * (
            (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            ) / (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
          )
          WHEN currency_code = 'GBP' THEN event_amount * (
            (
              SELECT
                all_exchange_dates.gbp_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            ) / (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
          )
          WHEN currency_code = 'USD' THEN event_amount
          ELSE -99999999999
        END
      ) AS event_amount_in_usd,
      (
        CASE
          WHEN currency_code = 'ILS' THEN (event_amount - COALESCE(vat, 0)) / (
            SELECT
              all_exchange_dates.usd_rate
            FROM
              all_exchange_dates
            WHERE
              all_exchange_dates.exchange_date = COALESCE(debit_date::TEXT::date, event_date)
          )
          WHEN currency_code = 'EUR' THEN (event_amount - COALESCE(vat, 0)) * (
            (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            ) / (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
          )
          WHEN currency_code = 'GBP' THEN (event_amount - COALESCE(vat, 0)) * (
            (
              SELECT
                all_exchange_dates.gbp_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            ) / (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
          )
          WHEN currency_code = 'USD' THEN event_amount - COALESCE(vat, 0)
          ELSE -99999999999
        END
      ) AS event_amount_in_usd_with_vat_if_exists,
      (
        CASE
          WHEN currency_code = 'ILS' THEN COALESCE(vat, 0) / (
            SELECT
              all_exchange_dates.usd_rate
            FROM
              all_exchange_dates
            WHERE
              all_exchange_dates.exchange_date = COALESCE(debit_date::TEXT::date, event_date)
          )
          WHEN currency_code = 'EUR' THEN COALESCE(vat, 0) * (
            (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            ) / (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
          )
          WHEN currency_code = 'GBP' THEN COALESCE(vat, 0) * (
            (
              SELECT
                all_exchange_dates.gbp_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            ) / (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
          )
          WHEN currency_code = 'USD' THEN COALESCE(vat, 0)
          ELSE -99999999999
        END
      ) AS event_vat_amount_in_usd
    FROM
      accounter_schema.all_transactions
  ),
  this_month_private_creditcard AS (
    SELECT
      event_date,
      SUM(event_amount_in_usd_with_vat_if_exists) OVER (
        ORDER BY
          event_date,
          event_number
      ) AS sum_till_this_point,
      event_number
    FROM
      local_formatted_merged_tables
    WHERE
      account_type = 'creditcard'
      AND account_number = 6264
      AND debit_date > now()
  ),
  this_month_business_creditcard AS (
    SELECT
      event_date,
      SUM(event_amount_in_usd_with_vat_if_exists) OVER (
        ORDER BY
          event_date,
          event_number
      ) AS sum_till_this_point,
      event_number
    FROM
      local_formatted_merged_tables
    WHERE
      account_type = 'creditcard'
      AND account_number = 2733
      AND debit_date > now()
    ORDER BY
      event_date,
      event_number
  ),
  dotan_dept AS (
    SELECT
      financial_accounts_to_balance,
      event_date,
      event_amount,
      currency_code,
      event_amount_in_usd,
      event_amount_in_usd_with_vat_if_exists,
      (
        CASE
          WHEN financial_accounts_to_balance = 'uri' THEN 0
          WHEN financial_accounts_to_balance = 'dotan' THEN event_amount_in_usd_with_vat_if_exists
          WHEN financial_accounts_to_balance = 'deposit' THEN 0
          WHEN financial_entity = 'VAT' THEN 0
          ELSE (event_amount_in_usd_with_vat_if_exists / 2)
        END
      ) * -1,
      SUM(
        (
          CASE
            WHEN financial_accounts_to_balance = 'uri' THEN 0
            WHEN financial_accounts_to_balance = 'dotan' THEN event_amount_in_usd_with_vat_if_exists
            WHEN financial_accounts_to_balance = 'deposit' THEN 0
            WHEN financial_entity = 'VAT' THEN 0
            WHEN financial_entity = 'pension' THEN 0
            WHEN financial_entity = 'training_fund' THEN 0
            ELSE (event_amount_in_usd_with_vat_if_exists / 2)
          END
        ) * -1
      ) OVER (
        ORDER BY
          event_date,
          event_number,
          event_amount,
          bank_reference,
          account_number
      ) AS sum_till_this_point,
      SUM(
        (
          CASE
            WHEN financial_accounts_to_balance = 'pension' THEN event_amount_in_usd_with_vat_if_exists
            ELSE 0
          END
        ) * -1
      ) OVER (
        ORDER BY
          event_date,
          event_number,
          event_amount,
          bank_reference,
          account_number
      ) AS pension_sum_till_this_point,
      SUM(
        (
          CASE
            WHEN financial_accounts_to_balance = 'training_fund' THEN event_amount_in_usd_with_vat_if_exists
            ELSE 0
          END
        ) * -1
      ) OVER (
        ORDER BY
          event_date,
          event_number,
          event_amount,
          bank_reference,
          account_number
      ) AS training_fund_sum_till_this_point,
      financial_entity,
      user_description,
      bank_reference,
      vat,
      event_vat_amount_in_usd,
      account_number,
      event_number
    FROM
      local_formatted_merged_tables
    WHERE
      (
        account_number = 2733
        OR account_number = 61066
      )
      AND event_date::date >= '2019-12-01'::TIMESTAMP
      AND financial_accounts_to_balance IN ('no', 'dotan', 'uri', 'training_fund', 'pension')
    ORDER BY
      event_date,
      event_number,
      event_amount,
      bank_reference,
      account_number
  ),
  dotan_future_dept AS (
    SELECT
      event_date,
      event_amount,
      currency_code,
      financial_entity,
      user_description,
      SUM(
        (
          (
            CASE
              WHEN currency_code = 'ILS' THEN (
                event_amount / (
                  SELECT
                    all_exchange_dates.usd_rate
                  FROM
                    all_exchange_dates
                  ORDER BY
                    all_exchange_dates.exchange_date DESC
                  LIMIT
                    1
                )
              )
              WHEN currency_code = 'EUR' THEN event_amount * (
                (
                  SELECT
                    all_exchange_dates.eur_rate
                  FROM
                    all_exchange_dates
                  ORDER BY
                    all_exchange_dates.exchange_date DESC
                  LIMIT
                    1
                ) / (
                  SELECT
                    all_exchange_dates.usd_rate
                  FROM
                    all_exchange_dates
                  ORDER BY
                    all_exchange_dates.exchange_date DESC
                  LIMIT
                    1
                )
              )
              WHEN currency_code = 'GBP' THEN event_amount * (
                (
                  SELECT
                    all_exchange_dates.gbp_rate
                  FROM
                    all_exchange_dates
                  ORDER BY
                    all_exchange_dates.exchange_date DESC
                  LIMIT
                    1
                ) / (
                  SELECT
                    all_exchange_dates.usd_rate
                  FROM
                    all_exchange_dates
                  ORDER BY
                    all_exchange_dates.exchange_date DESC
                  LIMIT
                    1
                )
              )
              WHEN currency_code = 'USD' THEN event_amount
              ELSE -99999999999
            END
          ) / 2
        ) * -1
      ) OVER (
        ORDER BY
          event_date,
          event_amount,
          user_description,
          account_number
      ) AS sum_till_this_point
    FROM
      accounter_schema.future_transactions
    WHERE
      (
        account_number = 2733
        OR account_number = 61066
      )
      AND event_date::date >= '2019-12-01'::TIMESTAMP
      AND financial_accounts_to_balance = 'no'
    ORDER BY
      event_date,
      event_amount,
      user_description,
      account_number
  ),
  new_business_account_transactions AS (
    SELECT
      event_date,
      currency_code,
      event_amount,
      event_amount_in_usd,
      event_amount_in_usd_with_vat_if_exists,
      SUM(
        CASE
          WHEN financial_accounts_to_balance = 'uri' THEN event_amount_in_usd_with_vat_if_exists
          WHEN financial_accounts_to_balance = 'dotan' THEN 0
          WHEN financial_accounts_to_balance = 'deposit' THEN 0
          WHEN financial_entity = 'VAT' THEN 0
          ELSE (event_amount_in_usd_with_vat_if_exists / 2)
        END
      ) OVER (
        ORDER BY
          event_date,
          event_number,
          event_amount,
          bank_reference,
          account_number
      ) AS sum_till_this_point,
      SUM(
        CASE
          WHEN financial_accounts_to_balance = 'uri' THEN 0
          WHEN financial_accounts_to_balance = 'dotan' THEN event_amount_in_usd_with_vat_if_exists
          WHEN financial_accounts_to_balance = 'deposit' THEN 0
          WHEN financial_entity = 'VAT' THEN 0
          ELSE (event_amount_in_usd_with_vat_if_exists / 2)
        END
      ) OVER (
        ORDER BY
          event_date,
          event_number,
          event_amount,
          bank_reference,
          account_number
      ) AS dotan_sum_till_this_point,
      financial_entity,
      user_description,
      SUM(
        CASE
          WHEN financial_entity = 'VAT' THEN event_amount_in_usd
          ELSE event_vat_amount_in_usd
        END
      ) OVER (
        ORDER BY
          event_date,
          event_number,
          event_amount,
          bank_reference,
          account_number
      ) AS sum_vat,
      vat,
      event_vat_amount_in_usd,
      bank_reference,
      account_number,
      event_number
    FROM
      local_formatted_merged_tables
    WHERE
      (
        account_number = 1082
        OR account_number = 466803
        OR account_number = 1074
      )
      AND financial_entity <> 'Isracard'
    ORDER BY
      event_date,
      event_number,
      event_amount,
      bank_reference,
      account_number
  ),
  future_balance AS (
    SELECT
      event_date,
      event_amount,
      currency_code,
      financial_entity,
      user_description,
      SUM(
        (
          CASE
            WHEN currency_code = 'ILS' THEN (
              event_amount / (
                SELECT
                  all_exchange_dates.usd_rate
                FROM
                  all_exchange_dates
                ORDER BY
                  all_exchange_dates.exchange_date DESC
                LIMIT
                  1
              )
            )
            WHEN currency_code = 'EUR' THEN event_amount * (
              (
                SELECT
                  all_exchange_dates.eur_rate
                FROM
                  all_exchange_dates
                ORDER BY
                  all_exchange_dates.exchange_date DESC
                LIMIT
                  1
              ) / (
                SELECT
                  all_exchange_dates.usd_rate
                FROM
                  all_exchange_dates
                ORDER BY
                  all_exchange_dates.exchange_date DESC
                LIMIT
                  1
              )
            )
            WHEN currency_code = 'GBP' THEN event_amount * (
              (
                SELECT
                  all_exchange_dates.gbp_rate
                FROM
                  all_exchange_dates
                ORDER BY
                  all_exchange_dates.exchange_date DESC
                LIMIT
                  1
              ) / (
                SELECT
                  all_exchange_dates.usd_rate
                FROM
                  all_exchange_dates
                ORDER BY
                  all_exchange_dates.exchange_date DESC
                LIMIT
                  1
              )
            )
            WHEN currency_code = 'USD' THEN event_amount
            ELSE -99999999999
          END
        )
      ) OVER (
        ORDER BY
          event_date,
          event_amount,
          user_description,
          account_number
      ) AS sum_till_this_point
    FROM
      accounter_schema.future_transactions
    WHERE
      (
        account_number = 2733
        OR account_number = 61066
      )
      AND event_date::date >= '2019-12-01'::TIMESTAMP
    ORDER BY
      event_date,
      event_amount,
      user_description,
      account_number
  ),
  current_vat_status AS (
    SELECT
      event_date,
      vat,
      event_amount,
      bank_reference,
      account_number,
      SUM(
        (
          CASE
            WHEN financial_entity = 'VAT' THEN (event_amount_in_usd * -1)
            ELSE (event_vat_amount_in_usd * -1)
          END
        )::NUMERIC(9, 2)
      ) OVER (
        ORDER BY
          event_date,
          event_amount,
          bank_reference,
          account_number
      ) AS VAT_status,
      financial_entity
    FROM
      local_formatted_merged_tables
    WHERE
      (
        account_number = 2733
        OR account_number = 61066
      )
      AND (
        vat IS NOT NULL
        AND vat <> 0
        OR financial_entity = 'VAT'
      )
      AND event_date::TEXT::date >= '2019-01-01' --        AND event_date::text::date <= '2019-12-31'
      OR event_date IS NULL
    ORDER BY
      event_date,
      event_amount,
      bank_reference,
      account_number
  ),
  ils_business_balance AS (
    SELECT DISTINCT
      ON (event_date) event_date,
      current_balance,
      account_number
    FROM
      accounter_schema.poalim_ils_account_transactions
    WHERE
      account_number = 61066
    ORDER BY
      event_date,
      expanded_event_date DESC
  ),
  ils_personal_balance AS (
    SELECT DISTINCT
      ON (event_date) event_date,
      current_balance,
      account_number
    FROM
      accounter_schema.poalim_ils_account_transactions
    WHERE
      account_number = 410915
    ORDER BY
      event_date,
      expanded_event_date DESC
  ),
  usd_business_balance AS (
    SELECT DISTINCT
      ON (executing_date) executing_date,
      current_balance,
      account_number
    FROM
      accounter_schema.poalim_usd_account_transactions
    WHERE
      account_number = 61066
    ORDER BY
      executing_date,
      event_number DESC
  ),
  usd_personal_balance AS (
    SELECT DISTINCT
      ON (executing_date) executing_date,
      current_balance,
      account_number
    FROM
      accounter_schema.poalim_usd_account_transactions
    WHERE
      account_number = 410915
    ORDER BY
      executing_date,
      event_number DESC
  ),
  euro_business_balance AS (
    SELECT DISTINCT
      ON (executing_date) executing_date,
      current_balance,
      account_number
    FROM
      accounter_schema.poalim_eur_account_transactions
    WHERE
      account_number = 61066
    ORDER BY
      executing_date,
      event_number DESC
  ),
  euro_personal_balance AS (
    SELECT DISTINCT
      ON (executing_date) executing_date,
      current_balance,
      account_number
    FROM
      accounter_schema.poalim_eur_account_transactions
    WHERE
      account_number = 410915
    ORDER BY
      executing_date,
      event_number DESC
  ),
  usd_interactive_brokers_personal_balance AS (
    SELECT DISTINCT
      ON (date) date,
      balance
    FROM
      accounter_schema.interactive_broker_account
    ORDER BY
      date DESC
  ),
  all_balances AS (
    SELECT
      dt,
      (
        SELECT
          t1.current_balance
        FROM
          ils_business_balance t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          event_date DESC
        LIMIT
          1
      ) ils_business_balance,
      (
        SELECT
          t1.current_balance
        FROM
          ils_personal_balance t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          event_date DESC
        LIMIT
          1
      ) ils_personal_balance,
      (
        SELECT
          t1.current_balance
        FROM
          usd_business_balance t1
        WHERE
          date_trunc('day', t1.executing_date)::date <= times_table.dt
        ORDER BY
          executing_date DESC
        LIMIT
          1
      ) usd_business_balance,
      (
        SELECT
          t1.current_balance
        FROM
          usd_personal_balance t1
        WHERE
          date_trunc('day', t1.executing_date)::date <= times_table.dt
        ORDER BY
          executing_date DESC
        LIMIT
          1
      ) usd_personal_balance,
      (
        SELECT
          t1.current_balance
        FROM
          euro_business_balance t1
        WHERE
          date_trunc('day', t1.executing_date)::date <= times_table.dt
        ORDER BY
          executing_date DESC
        LIMIT
          1
      ) eur_business_balance,
      (
        SELECT
          t1.current_balance
        FROM
          euro_personal_balance t1
        WHERE
          date_trunc('day', t1.executing_date)::date <= times_table.dt
        ORDER BY
          executing_date DESC
        LIMIT
          1
      ) eur_personal_balance,
      (
        SELECT
          t1.balance
        FROM
          usd_interactive_brokers_personal_balance t1
        WHERE
          date_trunc('day', t1.date)::date <= times_table.dt
        ORDER BY
          date DESC
        LIMIT
          1
      ) interative_brokers_personal,
      (
        SELECT
          t1.eur
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          date_trunc('day', t1.exchange_date)::date <= times_table.dt
        ORDER BY
          t1.exchange_date DESC
        LIMIT
          1
      ) eur_rate,
      (
        SELECT
          t1.gbp
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          date_trunc('day', t1.exchange_date)::date <= times_table.dt
        ORDER BY
          t1.exchange_date DESC
        LIMIT
          1
      ) gbp_rate,
      (
        SELECT
          t1.usd
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          date_trunc('day', t1.exchange_date)::date <= times_table.dt
        ORDER BY
          t1.exchange_date DESC
        LIMIT
          1
      ) usd_rate,
      (
        SELECT
          t1.amount
        FROM
          accounter_schema.dotan_debt t1
        WHERE
          date_trunc('day', t1.debt_date)::date <= times_table.dt
        ORDER BY
          t1.debt_date DESC
        LIMIT
          1
      ) dotan_old_dept,
      (
        SELECT
          t1.sum_till_this_point
        FROM
          dotan_dept t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          t1.event_number DESC,
          t1.event_amount,
          t1.bank_reference,
          t1.account_number
        LIMIT
          1
      ) dotan_dept,
      (
        SELECT
          t1.pension_sum_till_this_point
        FROM
          dotan_dept t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          t1.event_number DESC,
          t1.event_amount,
          t1.bank_reference,
          t1.account_number
        LIMIT
          1
      ) pension,
      (
        SELECT
          t1.training_fund_sum_till_this_point
        FROM
          dotan_dept t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          t1.event_number DESC,
          t1.event_amount,
          t1.bank_reference,
          t1.account_number
        LIMIT
          1
      ) training_fund,
      (
        SELECT
          t1.sum_till_this_point
        FROM
          new_business_account_transactions t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          t1.event_number DESC,
          t1.event_amount,
          t1.bank_reference,
          t1.account_number
        LIMIT
          1
      ) new_business_account_transactions,
      (
        SELECT
          t1.user_description
        FROM
          dotan_dept t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          t1.event_number DESC,
          t1.event_amount,
          t1.bank_reference,
          t1.account_number
        LIMIT
          1
      ) dotan_event,
      (
        SELECT
          t1.VAT_status
        FROM
          current_vat_status t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          t1.bank_reference DESC
        LIMIT
          1
      ) VAT,
      (
        SELECT
          t1.sum_till_this_point
        FROM
          this_month_private_creditcard t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          t1.event_number DESC
        LIMIT
          1
      ) this_month_private_creditcard,
      (
        SELECT
          t1.sum_till_this_point
        FROM
          this_month_business_creditcard t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          t1.event_number DESC
        LIMIT
          1
      ) this_month_business_creditcard,
      (
        SELECT
          t1.sum_till_this_point
        FROM
          future_balance t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          user_description DESC
        LIMIT
          1
      ) future_transactions,
      (
        SELECT
          t1.sum_till_this_point
        FROM
          dotan_future_dept t1
        WHERE
          date_trunc('day', t1.event_date)::date <= times_table.dt
        ORDER BY
          t1.event_date DESC,
          user_description DESC
        LIMIT
          1
      ) dotan_future_dept
    FROM
      times_table
    ORDER BY
      dt
  ),
  caluculated_values AS (
    SELECT
      dt,
      ils_business_balance,
      usd_business_balance,
      eur_business_balance,
      (ils_business_balance / usd_rate) AS ils_business_in_usd,
      (eur_business_balance * (eur_rate / usd_rate)) AS eur_business_in_usd,
      this_month_business_creditcard,
      ils_personal_balance,
      usd_personal_balance,
      eur_personal_balance,
      (ils_personal_balance / usd_rate) AS ils_personal_in_usd,
      (eur_personal_balance * (eur_rate / usd_rate)) AS eur_personal_in_usd,
      interative_brokers_personal,
      this_month_private_creditcard,
      (dotan_old_dept / usd_rate) AS dotan_old_dept,
      dotan_dept,
      pension,
      training_fund,
      new_business_account_transactions,
      VAT,
      future_transactions,
      dotan_future_dept
    FROM
      all_balances
  ),
  all_balances_till_today AS (
    SELECT
      dt,
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
        COALESCE(ils_business_in_usd, 0) + COALESCE(usd_business_balance, 0) + COALESCE(eur_business_in_usd, 0) + COALESCE(this_month_business_creditcard, 0) + COALESCE(new_business_account_transactions, 0)
      ) AS all_business_accounts,
      (
        COALESCE(ils_business_in_usd, 0) + COALESCE(usd_business_balance, 0) + COALESCE(eur_business_in_usd, 0) - COALESCE(dotan_old_dept, 0) + COALESCE(dotan_dept, 0) + COALESCE(VAT, 0) + COALESCE(this_month_business_creditcard, 0) + COALESCE(future_transactions, 0) + COALESCE(dotan_future_dept, 0) + COALESCE(new_business_account_transactions, 0)
      ) AS everything_business,
      ils_personal_balance,
      ils_personal_in_usd,
      usd_personal_balance,
      eur_personal_balance,
      eur_personal_in_usd,
      pension,
      training_fund,
      interative_brokers_personal,
      (
        COALESCE(ils_personal_in_usd, 0) + COALESCE(usd_personal_balance, 0) + COALESCE(eur_personal_in_usd, 0) + COALESCE(this_month_private_creditcard, 0) + COALESCE(pension, 0) + COALESCE(training_fund, 0) + COALESCE(interative_brokers_personal, 0)
      ) AS everything_personal,
      (
        COALESCE(ils_business_in_usd, 0) + COALESCE(usd_business_balance, 0) + COALESCE(eur_business_in_usd, 0) - COALESCE(dotan_old_dept, 0) + COALESCE(dotan_dept, 0) + COALESCE(VAT, 0) + COALESCE(this_month_business_creditcard, 0) + COALESCE(ils_personal_in_usd, 0) + COALESCE(usd_personal_balance, 0) + COALESCE(eur_personal_in_usd, 0) + COALESCE(this_month_private_creditcard, 0) + COALESCE(future_transactions, 0) + COALESCE(dotan_future_dept, 0) + COALESCE(new_business_account_transactions, 0) + COALESCE(pension, 0) + COALESCE(training_fund, 0) + COALESCE(interative_brokers_personal, 0)
      ) AS everything
    FROM
      caluculated_values
  )
SELECT
  *
FROM
  all_balances_till_today;
