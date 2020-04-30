select * from missing_invoice_dates('2020-03-01');

create or replace function missing_invoice_dates(month_input varchar)
returns setof formatted_merged_tables
LANGUAGE SQL
AS $$

WITH this_month_business AS (
    SELECT *
    FROM formatted_merged_tables
    WHERE business_trip IS NULL
      AND (account_number = 2733 OR account_number = 61066)
      AND (((financial_entity != 'Isracard' OR financial_entity IS NULL) AND
            account_type != 'creditcard' AND
            event_date::text::date >= date_trunc('month', month_input::date) AND
            event_date::text::date <=
            (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date OR
            event_date IS NULL)
        OR (
                   (account_type = 'creditcard' OR financial_entity = 'Isracard') AND
                   (
                                   debit_date::text::date <= get_creditcard_charge_date(month_input)::date AND
                                   debit_date::text::date >
                                   get_creditcard_charge_date_former_month(month_input)::date OR
                                   (debit_date IS NULL AND
                                    event_date::text::date >= date_trunc('month', month_input::date) AND
                                    event_date::text::date <=
                                    (date_trunc('month', month_input::date) + interval '1 month' -
                                     interval '1 day')::date)
                       )))
)
SELECT *
FROM this_month_business
WHERE tax_invoice_date IS NULL AND
      financial_entity != 'Poalim' AND /*TODO: Check if we can get those invoices */
      financial_entity != 'Isracard' AND
      financial_entity != 'Tax' AND
      financial_entity != 'Uri Goldshtein Employee Tax Withholding' AND
      financial_entity != 'VAT'
ORDER BY event_date;

$$;