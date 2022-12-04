SELECT
  *
FROM
  all_vat_payments ();

CREATE
OR REPLACE FUNCTION all_vat_payments () RETURNS TABLE (
  event_date date,
  event_amount NUMERIC(9, 2),
  bank_reference INTEGER,
  account_number INTEGER,
  sum_vat NUMERIC(9, 2)
) LANGUAGE SQL AS $$


SELECT
   event_date, event_amount, bank_reference, account_number,
   SUM(event_amount::numeric(9,2)) OVER (ORDER BY event_date, event_amount, bank_reference, account_number) as sum_all_vat
FROM formatted_merged_tables
WHERE
    financial_entity = 'VAT' AND
    (account_number = 2733 OR account_number = 61066) AND
      event_date::text::date >= '2019-01-01'
--        AND event_date::text::date <= '2019-12-31'
      OR event_date IS NULL
ORDER BY event_date, event_amount, bank_reference, account_number

$$;
