select * from acending_invoice_numbers();

create or replace function acending_invoice_numbers()
returns TABLE
(
    tax_invoice_number character varying,
    user_description varchar,
    financial_entity varchar,
    event_amount numeric(9,2),
    event_date date
)
LANGUAGE SQL
AS $$

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