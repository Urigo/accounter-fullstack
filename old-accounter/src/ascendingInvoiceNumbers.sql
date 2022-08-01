SELECT
  *
FROM
  acending_invoice_numbers();

CREATE
OR REPLACE FUNCTION acending_invoice_numbers() RETURNS TABLE (
  tax_invoice_number CHARACTER VARYING,
  user_description VARCHAR,
  financial_entity VARCHAR,
  event_amount NUMERIC(9, 2),
  event_date date
) LANGUAGE SQL AS $$

SELECT tax_invoice_number,
       user_description,
       financial_entity,
       event_amount,
       event_date
FROM accounter_schema.all_transactions
WHERE
      (account_number = 2733 OR account_number = 61066) AND
      event_amount > 0 AND
      financial_entity != 'Poalim' AND
      financial_entity != 'VAT' AND
      financial_entity != 'Uri Goldshtein' AND
      financial_entity != 'Isracard' AND
      tax_invoice_number ~ '^[^A-z]+$'
ORDER BY tax_invoice_number DESC NULLS LAST;

$$;
