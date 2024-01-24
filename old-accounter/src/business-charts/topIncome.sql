SELECT
  *
FROM
  top_income_all_time;

CREATE OR REPLACE VIEW top_income_all_time AS
SELECT
  SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2),
  financial_entity
FROM
  formatted_merged_tables
WHERE
  business_trip IS NULL
  AND (
    account_number = 2733
    OR account_number = 61066
  )
  AND personal_category <> 'conversion'
  AND financial_entity <> 'Uri Goldshtein'
  AND financial_entity <> 'Tax'
  AND financial_entity <> 'VAT'
  AND financial_entity <> 'Dotan Simha'
  AND financial_entity <> 'Isracard'
  AND event_amount IS NOT NULL
  AND event_amount > 0 --       event_date::text::date >= '2019-12-01' AND
  --       event_date::text::date <= '2019-12-31' OR
  --       event_date IS NULL
GROUP BY
  financial_entity
ORDER BY
  SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2) DESC NULLS LAST;
