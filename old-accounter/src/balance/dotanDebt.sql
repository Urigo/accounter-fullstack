CREATE OR REPLACE VIEW
  dotan_dept AS
SELECT
  event_date,
  event_amount,
  currency_code,
  event_amount_in_usd_with_vat_if_exists,
  SUM((event_amount_in_usd_with_vat_if_exists / 2) * -1) OVER (
    ORDER BY
      event_date,
      event_number,
      event_amount,
      bank_reference,
      account_number
  ) AS sum_till_this_point,
  bank_reference,
  account_number,
  event_number,
  user_description
FROM
  formatted_merged_tables
WHERE
  (
    account_number = 2733
    OR account_number = 61066
  )
  AND event_date::date >= '2019-12-01'::TIMESTAMP
  AND financial_accounts_to_balance = 'no'
ORDER BY
  event_date DESC,
  event_number,
  event_amount,
  bank_reference,
  account_number;

SELECT
  *,
  event_amount_in_usd_with_vat_if_exists
FROM
  dotan_dept;

SELECT
  event_date,
  event_amount,
  currency_code,
  event_amount_in_usd_with_vat_if_exists,
  event_amount_in_usd,
  SUM(event_amount_in_usd_with_vat_if_exists * -1) OVER (
    ORDER BY
      event_date,
      event_number,
      event_amount,
      bank_reference,
      account_number
  ) AS sum_till_this_point,
  bank_reference,
  account_number,
  event_number,
  user_description
FROM
  formatted_merged_tables
WHERE
  (
    account_number = 2733
    OR account_number = 61066
  )
  AND event_date::date >= '2019-12-31'::TIMESTAMP
  AND financial_entity = 'Dotan Simha'
ORDER BY
  event_date,
  event_number,
  event_amount,
  bank_reference,
  account_number;

CREATE OR REPLACE VIEW
  dotan_future_dept AS
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
          WHEN currency_code = 'EUR' THEN event_amount / (
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
  account_number;

SELECT
  event_date,
  event_amount,
  currency_code,
  event_amount_in_usd_with_vat_if_exists,
  SUM(event_amount_in_usd_with_vat_if_exists / 2) OVER (
    ORDER BY
      event_date,
      event_number,
      event_amount,
      bank_reference,
      account_number
  ) AS sum_till_this_point,
  bank_reference,
  account_number,
  event_number,
  user_description
FROM
  formatted_merged_tables
WHERE
  (
    account_number = 1082
    OR account_number = 466803
    OR account_number = 1074
  )
  AND event_date::date >= '2019-12-01'::TIMESTAMP
  AND personal_category <> 'conversion'
  AND financial_entity <> 'Isracard' --           AND financial_accounts_to_balance = 'no'
ORDER BY
  event_date,
  event_number,
  event_amount,
  bank_reference,
  account_number;

SELECT
  *
FROM
  accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
WHERE
  hashavshevet_id IS NULL
  AND to_date(date_3, 'DD/MM/YYYY') >= to_date('01/10/2020', 'DD/MM/YYYY')
ORDER BY
  (to_date(date_3, 'DD/MM/YYYY')),
  original_id,
  invoice_date;
