SELECT
  ID,
  Date,
  SUM(Quantity) OVER (
    PARTITION BY
      ID
    ORDER BY
      DATE
  )
FROM
  formatted_merged_tables
WHERE;

SELECT
  *
FROM
  top_private_expenses;

CREATE OR REPLACE VIEW
  top_private_expenses AS
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
