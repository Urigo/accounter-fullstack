create or replace function get_creditcard_charge_date_former_month(month_input varchar)
RETURNS date
LANGUAGE SQL
AS $$


SELECT debit_date
FROM formatted_merged_tables
WHERE
    financial_entity = 'Isracard' AND
    event_date::text::date >= (date_trunc('month', month_input::date))::date AND
    event_date::text::date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
LIMIT 1;


$$;


create or replace function get_creditcard_charge_date(month_input varchar)
RETURNS date
LANGUAGE SQL
AS $$


SELECT debit_date
FROM formatted_merged_tables
WHERE
    financial_entity = 'Isracard' AND
    event_date::text::date >= (date_trunc('month', month_input::date) +  interval '1 month')::date AND
    event_date::text::date <= (date_trunc('month', month_input::date) + interval '2 month' - interval '1 day')::date
LIMIT 1;


$$;