SELECT
  *
FROM
  top_private_expenses_with_business_account;

CREATE
OR REPLACE VIEW top_private_expenses_with_business_account AS
SELECT
  ABS(
    SUM(event_amount_in_usd_with_vat_if_exists) :: NUMERIC(9, 2)
  ),
  personal_category
FROM
  formatted_merged_tables
WHERE
  personal_category <> 'conversion'
  AND personal_category <> 'business'
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
  SUM(event_amount_in_usd_with_vat_if_exists) :: NUMERIC(9, 2) NULLS LAST;