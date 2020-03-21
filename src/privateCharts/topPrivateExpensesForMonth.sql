SELECT *
FROM top_private_expenses_for_month('2020-01-01');


CREATE OR REPLACE FUNCTION top_private_expenses_for_month(month_input varchar)
    RETURNS TABLE
            (
                sum      numeric(9, 2),
                category varchar
            )
    LANGUAGE SQL
AS
$$

SELECT ABS(SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9, 2)),
       personal_category
FROM formatted_merged_tables
WHERE (account_number = 9217 OR account_number = 410915)
  AND personal_category <> 'conversion'
  AND financial_entity <> 'Uri Goldshtein'
  AND financial_entity <> 'Tax'
  AND financial_entity <> 'VAT'
  AND financial_entity <> 'Dotan Simha'
  AND financial_entity <> 'Isracard'
  AND event_amount < 0
  AND event_date::text::date >= date_trunc('month', month_input::date)
  AND event_date::text::date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
  --       event_date IS NULL
GROUP BY personal_category
ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9, 2) NULLS LAST;

$$;