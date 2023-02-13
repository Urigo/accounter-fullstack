WITH
  all_exchange_dates AS (
    SELECT
      dt AS exchange_date,
      (
        SELECT
          t1.eur
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          DATE_TRUNC('day', t1.exchange_date)::date <= times_table.dt
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
          DATE_TRUNC('day', t1.exchange_date)::date <= times_table.dt
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
          DATE_TRUNC('day', t1.exchange_date)::date <= times_table.dt
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
  formatted_merged_tables AS (
    SELECT
      *,
      (
        CASE
          WHEN currency_code = 'ILS' THEN (event_amount - COALESCE(vat, 0)) / (
            SELECT
              all_exchange_dates.usd_rate
            FROM
              all_exchange_dates
            WHERE
              all_exchange_dates.exchange_date <= debit_date::TEXT::date
            ORDER BY
              all_exchange_dates.exchange_date DESC
            LIMIT
              1
          )
          WHEN currency_code = 'EUR' THEN (event_amount - COALESCE(vat, 0)) * (
            (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date <= debit_date::TEXT::date
              ORDER BY
                all_exchange_dates.exchange_date DESC
              LIMIT
                1
            ) / (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date <= debit_date::TEXT::date
              ORDER BY
                all_exchange_dates.exchange_date DESC
              LIMIT
                1
            )
          )
          WHEN currency_code = 'GBP' THEN (event_amount - COALESCE(vat, 0)) * (
            (
              SELECT
                all_exchange_dates.gbp_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date <= debit_date::TEXT::date
              ORDER BY
                all_exchange_dates.exchange_date DESC
              LIMIT
                1
            ) / (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date <= debit_date::TEXT::date
              ORDER BY
                all_exchange_dates.exchange_date DESC
              LIMIT
                1
            )
          )
          WHEN currency_code = 'USD' THEN event_amount - COALESCE(vat, 0)
          ELSE -99999999999
        END
      ) AS event_amount_in_usd_with_vat_if_exists
    FROM
      accounter_schema.all_transactions
  ),
  transactions_exclude AS (
    SELECT
      *
    FROM
      formatted_merged_tables
    WHERE
      personal_category <> 'conversion'
      AND personal_category <> 'investments'
      AND financial_entity <> 'Isracard'
      AND financial_entity <> 'Tax'
      AND financial_entity <> 'VAT'
      AND financial_entity <> 'Tax Shuma'
      AND financial_entity <> 'Tax Corona Grant'
      AND financial_entity <> 'Uri Goldshtein'
      AND financial_entity <> 'Uri Goldshtein Hoz'
      AND financial_entity <> 'Social Security Deductions'
      AND financial_entity <> 'Tax Deductions'
      AND financial_entity <> 'Dotan Simha'
  ),
  business_accounts AS (
    SELECT
      account_number
    FROM
      accounter_schema.financial_accounts
    WHERE
      private_business = 'business' -- where owner = '6a20aa69-57ff-446e-8d6a-1e96d095e988'
  )
SELECT
  --  month
  TO_CHAR(event_date, 'YYYY/mm') AS date,
  --  year
  -- to_char(event_date, 'YYYY') as date,
  SUM(
    CASE
      WHEN (
        event_amount > 0
        AND personal_category = 'business'
        AND account_number IN (
          SELECT
            *
          FROM
            business_accounts
        )
      ) THEN event_amount_in_usd_with_vat_if_exists
      ELSE 0
    END
  )::float4 AS business_income,
  SUM(
    CASE
      WHEN (
        event_amount < 0
        AND personal_category = 'business'
        AND account_number IN (
          SELECT
            *
          FROM
            business_accounts
        )
      ) THEN event_amount_in_usd_with_vat_if_exists
      ELSE 0
    END
  )::float4 AS business_expenses,
  SUM(
    CASE
      WHEN (
        personal_category = 'business'
        AND account_number IN (
          SELECT
            *
          FROM
            business_accounts
        )
      ) THEN event_amount_in_usd_with_vat_if_exists
      ELSE 0
    END
  )::float4 AS overall_business_profit,
  SUM(
    CASE
      WHEN (
        personal_category = 'business'
        AND account_number IN (
          SELECT
            *
          FROM
            business_accounts
        )
      ) THEN event_amount_in_usd_with_vat_if_exists / 2
      ELSE 0
    END
  )::float4 AS business_profit_share,
  SUM(
    CASE
      WHEN (
        event_amount < 0
        AND personal_category <> 'business'
      ) THEN event_amount_in_usd_with_vat_if_exists
      ELSE 0
    END
  )::float4 AS private_expenses,
  SUM(
    CASE
      WHEN personal_category <> 'business' THEN event_amount_in_usd_with_vat_if_exists
      ELSE 0
    END
  )::float4 AS overall_private
FROM
  transactions_exclude -- where
  --     account_number in (select account_number
  --                        from accounter_schema.financial_accounts accounts
  --                        where accounts.private_business = 'business')
WHERE
  event_date::TEXT::date >= '2020-10-01'::TEXT::date
GROUP BY
  date
ORDER BY
  date;
