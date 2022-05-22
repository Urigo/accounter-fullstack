create or replace function this_month_business(month_input varchar)
    RETURNS SETOF formatted_merged_tables
    LANGUAGE SQL
AS
$$


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
                               debit_date::text::date > get_creditcard_charge_date_former_month(month_input)::date OR
                               (debit_date IS NULL AND
                                event_date::text::date >= date_trunc('month', month_input::date) AND
                                event_date::text::date <=
                                (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date)
                   )));


$$;