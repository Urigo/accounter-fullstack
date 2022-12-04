SELECT
  top_private_expenses_for_month ('2020-01-01'),
  top_private_expenses_for_month ('2020-02-01'),
  top_private_expenses_for_month ('2020-03-01'),
  top_private_expenses_for_month ('2020-04-01'),
  top_private_expenses_for_month ('2020-05-01'),
  top_private_expenses_for_month ('2020-06-01'),
  top_private_expenses_for_month ('2020-07-01'),
  top_private_expenses_for_month ('2020-08-01'),
  top_private_expenses_for_month ('2020-09-01'),
  top_private_expenses_for_month ('2020-10-01'),
  top_private_expenses_for_month ('2020-11-01'),
  top_private_expenses_for_month ('2020-12-01');

CREATE
OR REPLACE FUNCTION top_private_expenses_for_month (month_input VARCHAR) RETURNS TABLE (sum NUMERIC(9, 2), category VARCHAR) LANGUAGE SQL AS $$

SELECT ABS(SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9, 2)),
       personal_category
FROM formatted_merged_tables
WHERE (account_number = 9217 OR account_number = 410915 or account_number = 6264)
  AND personal_category != 'creditcard'
--   AND event_amount < 0
  AND event_date >= date_trunc('month', month_input::date)
  AND event_date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
  --       event_date IS NULL
GROUP BY personal_category
ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9, 2) NULLS LAST;

$$;

SELECT
  *
FROM
  expenses_by_category_for_month ('2020-10-01', 'food');

CREATE
OR REPLACE FUNCTION expenses_by_category_for_month (
  month_input VARCHAR,
  personal_category_input VARCHAR
) RETURNS TABLE (sum NUMERIC(9, 2), description VARCHAR) LANGUAGE SQL AS $$

SELECT event_amount_in_usd_with_vat_if_exists,
       bank_description
FROM formatted_merged_tables
WHERE personal_category = personal_category_input
  and (account_number = 9217 OR account_number = 410915 or account_number = 6264)
  AND personal_category != 'creditcard'
--   AND event_amount < 0
  AND event_date >= date_trunc('month', month_input::date)
  AND event_date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
  --       event_date IS NULL
ORDER BY event_amount_in_usd_with_vat_if_exists::numeric(9, 2) NULLS LAST;

$$;

SELECT
  event_date,
  event_amount_in_usd,
  event_amount,
  currency_code,
  user_description,
  financial_entity,
  bank_description
FROM
  formatted_merged_tables
WHERE
  personal_category = 'food'
  AND event_date >= '2020-10-01'::date
  AND event_date <= '2020-10-30'::date
ORDER BY
  event_amount;

SELECT
  sum(event_amount_in_usd),
  personal_category
FROM
  formatted_merged_tables
WHERE
  event_date >= '2020-10-01'::date
  AND event_date <= '2020-10-30'::date
GROUP BY
  personal_category
ORDER BY
  sum(event_amount_in_usd);

SELECT
  *
FROM
  formatted_merged_tables
WHERE
  event_date >= '2020-10-01'::date
  AND event_date <= '2020-10-30'::date
  AND personal_category IS NULL
ORDER BY
  event_amount_in_usd;

SELECT
  event_date,
  financial_entity,
  tax_invoice_number,
  event_amount,
  currency_code,
  user_description,
  bank_description,
  *
FROM
  formatted_merged_tables
WHERE
  event_amount > 0
  AND account_number = 61066
  AND event_date >= '2020-07-01'::date
  AND financial_entity != 'VAT'
  AND financial_entity != 'Isracard'
  AND financial_entity != 'Poalim'
ORDER BY
  event_date::date;
