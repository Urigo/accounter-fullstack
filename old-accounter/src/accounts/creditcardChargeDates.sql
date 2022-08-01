SELECT
  *
FROM
  get_creditcard_charge_date('2020-10-01');

SELECT
  *
FROM
  get_creditcard_charge_date_former_month('2020-10-01');

CREATE
OR REPLACE FUNCTION get_creditcard_charge_date_former_month(month_input VARCHAR) RETURNS date LANGUAGE SQL AS $$


SELECT debit_date
FROM formatted_merged_tables
WHERE
    financial_entity = 'Isracard' AND
    event_date::text::date >= (date_trunc('month', month_input::date))::date AND
    event_date::text::date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
LIMIT 1;


$$;

CREATE
OR REPLACE FUNCTION get_creditcard_charge_date(month_input VARCHAR) RETURNS date LANGUAGE SQL AS $$


SELECT debit_date
FROM formatted_merged_tables
WHERE
    financial_entity = 'Isracard' AND
    event_date::text::date >= (date_trunc('month', month_input::date) +  interval '1 month')::date AND
    event_date::text::date <= (date_trunc('month', month_input::date) + interval '2 month' - interval '1 day')::date
LIMIT 1;


$$;
