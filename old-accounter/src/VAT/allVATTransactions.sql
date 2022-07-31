SELECT
  *
FROM
  all_vat_transactions();

CREATE
OR REPLACE FUNCTION all_vat_transactions() RETURNS TABLE (
  vat NUMERIC(9, 2),
  user_description VARCHAR,
  event_date date
) LANGUAGE SQL AS $$


SELECT
   vat,
   user_description,
   event_date
FROM formatted_merged_tables
WHERE
  vat IS NOT NULL AND
  vat <> 0 AND
  (account_number = 2733 OR account_number = 61066) AND
      event_date::text::date >= '2019-01-01'
--           AND event_date::text::date <= '2019-12-31'
      OR event_date IS NULL
ORDER BY event_date desc;

$$;
