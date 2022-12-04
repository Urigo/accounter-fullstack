 -- Overall income last year
SELECT
  --        event_date, financial_entity, (event_amount_in_usd_with_vat_if_exists)::numeric(9, 2), user_description
  ABS(
    SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2)
  )
FROM
  formatted_merged_tables
WHERE
  event_amount > 0
  AND event_date::TEXT::date >= '2019-01-01'::TEXT::date
  AND event_date::TEXT::date <= '2019-12-31'::TEXT::date
  AND personal_category <> 'conversion'
  AND financial_entity <> 'VAT'
  AND financial_entity <> 'Tax Shuma'
  AND financial_entity <> 'Tax Corona Grant'
  AND financial_entity <> 'Dotan Simha'
  AND financial_entity <> 'Isracard'
  AND financial_entity <> 'Poalim'
  AND (
    account_number = 2733
    OR account_number = 61066
  ) -- GROUP BY financial_entity
  -- ORDER BY event_amount_in_usd_with_vat_if_exists::numeric(9, 2) desc NULLS LAST;
ORDER BY
  SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2) DESC NULLS LAST;

-- Overall income this year
SELECT
  --        event_date, financial_entity, (event_amount_in_usd_with_vat_if_exists)::numeric(9, 2), user_description
  ABS(
    SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2)
  )
FROM
  formatted_merged_tables
WHERE
  event_amount > 0
  AND event_date::TEXT::date >= '2020-01-01'::TEXT::date
  AND event_date::TEXT::date <= '2020-10-08'::TEXT::date
  AND personal_category <> 'conversion'
  AND financial_entity <> 'VAT'
  AND financial_entity <> 'Tax Shuma'
  AND financial_entity <> 'Tax Corona Grant'
  AND (
    account_number = 2733
    OR account_number = 61066
  ) -- GROUP BY financial_entity
ORDER BY
  SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2) DESC NULLS LAST;

-- ORDER BY event_amount_in_usd_with_vat_if_exists::numeric(9, 2) desc NULLS LAST;
-- Overall expenses last year
SELECT
  --        event_date, financial_entity, (event_amount_in_usd_with_vat_if_exists)::numeric(9, 2), user_description
  ABS(
    SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2)
  )
FROM
  formatted_merged_tables
WHERE
  event_amount < 0
  AND event_date::TEXT::date >= '2019-01-01'::TEXT::date
  AND event_date::TEXT::date <= '2019-12-31'::TEXT::date
  AND financial_entity <> 'Dotan Simha'
  AND personal_category <> 'conversion'
  AND financial_entity <> 'Uri Goldshtein Hoz'
  AND financial_entity <> 'Tax'
  AND financial_entity <> 'Isracard'
  AND financial_entity <> 'Uri Goldshtein'
  AND business_trip IS NULL --     AND financial_entity <> 'VAT'
  --     and financial_entity <> 'Tax Shuma'
  --     and financial_entity <> 'Tax Corona Grant'
  AND (
    account_number = 2733
    OR account_number = 61066
  );

-- GROUP BY financial_entity
-- ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9, 2) desc NULLS LAST;
-- ORDER BY event_amount_in_usd_with_vat_if_exists::numeric(9, 2) NULLS LAST;
-- Overall expenses this year
SELECT
  --        event_date, financial_entity, (event_amount_in_usd_with_vat_if_exists)::numeric(9, 2), user_description
  ABS(
    SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2)
  )
FROM
  formatted_merged_tables
WHERE
  event_amount < 0
  AND event_date::TEXT::date >= '2020-01-01'::TEXT::date
  AND event_date::TEXT::date <= '2020-10-08'::TEXT::date
  AND personal_category <> 'conversion'
  AND financial_entity <> 'Uri Goldshtein Hoz'
  AND financial_entity <> 'Tax'
  AND financial_entity <> 'Isracard'
  AND financial_entity <> 'Uri Goldshtein'
  AND business_trip IS NULL --     AND financial_entity <> 'VAT'
  --     and financial_entity <> 'Tax Shuma'
  --     and financial_entity <> 'Tax Corona Grant'
  AND (
    account_number = 2733
    OR account_number = 61066
  ) -- GROUP BY financial_entity
ORDER BY
  SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2) DESC NULLS LAST;

-- ORDER BY event_amount_in_usd_with_vat_if_exists::numeric(9, 2) NULLS LAST;
-- top private expenses this year
SELECT
  ABS(
    SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2)
  ),
  personal_category
FROM
  formatted_merged_tables
WHERE
  (
    account_number = 9217
    OR account_number = 410915
  )
  AND personal_category <> 'conversion'
  AND financial_entity <> 'Uri Goldshtein'
  AND financial_entity <> 'Tax'
  AND financial_entity <> 'VAT'
  AND financial_entity <> 'Dotan Simha'
  AND financial_entity <> 'Isracard' --         AND event_amount < 0
  --       event_date::text::date >= '2019-12-01' AND
  --       event_date::text::date <= '2019-12-31' OR
  --       event_date IS NULL
GROUP BY
  personal_category
ORDER BY
  SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2) NULLS LAST;
