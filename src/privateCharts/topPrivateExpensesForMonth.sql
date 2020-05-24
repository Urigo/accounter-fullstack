select *
FROM top_private_expenses_for_month('2020-03-01');

select *
FROM top_private_expenses_for_month('2020-04-01');

select *
FROM top_private_expenses_for_month('2020-05-01');


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
  AND personal_category != 'creditcard'
--   AND event_amount < 0
  AND event_date >= date_trunc('month', month_input::date)
  AND event_date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
  --       event_date IS NULL
GROUP BY personal_category
ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9, 2) NULLS LAST;

$$;