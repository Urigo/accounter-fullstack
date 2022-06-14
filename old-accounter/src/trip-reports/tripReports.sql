-- Budapest 04/2019
SELECT
  *
FROM
  trip_report(
    '2019-05-20',
    'נסעחול16',
    FALSE,
    ('2019-05-20' :: date - '2019-04-30' :: date + 1) + ('2019-06-01' :: date - '2019-05-29' :: date + 1) + ('2019-06-13' :: date - '2019-06-04' :: date + 1) + ('2019-07-04' :: date - '2019-06-28' :: date + 1),
    0
  );

-- Amsterdam 08/2019
SELECT
  *
FROM
  trip_report(
    '2019-05-20',
    'נסעחול23',
    TRUE,
    0,
    ('2019-08-14' :: date - '2019-08-09' :: date + 1) + ('2019-09-09' :: date - '2019-08-17' :: date + 1)
  );

-- Amsterdam 09/2019
SELECT
  *
FROM
  trip_report(
    '2019-10-15',
    'נסעחול25',
    TRUE,
    ('2019-10-01' :: date - '2019-09-21' :: date + 1) + ('2019-10-15' :: date - '2019-10-04' :: date + 1),
    0
  );

-- Copenhagen 10/2019
SELECT
  *
FROM
  trip_report(
    '2019-10-03',
    'נסעחול26',
    TRUE,
    ('2019-10-03' :: date - '2019-10-02' :: date + 1),
    0
  );

-- Amsterdam 11/2019
SELECT
  *
FROM
  trip_report(
    '2019-11-21',
    'נסעחול27',
    TRUE,
    ('2019-11-21' :: date - '2019-10-31' :: date + 1),
    0
  );

-- '2019-11-22'::date - '2019-12-04'::date, China 11/2019 28
-- '2019-12-05'::date - ''::date, Japan 11/2019 28
SELECT
  *
FROM
  trip_report(
    '2019-12-09',
    'נסעחול28',
    FALSE,
    1,
    ('2019-12-04' :: date - '2019-11-22' :: date + 1) - 1
  );

SELECT
  *
FROM
  trip_report(
    '2019-12-09',
    'נסעחול28',
    TRUE,
    0,
    ('2019-12-09' :: date - '2019-12-05' :: date + 1)
  );

-- Copenhagen 12/2019
SELECT
  *
FROM
  trip_report(
    '2019-12-14',
    'נסעחול29',
    TRUE,
    ('2019-12-14' :: date - '2019-12-10' :: date + 1),
    0
  );

-- Amsterdam 12/2019
SELECT
  *
FROM
  trip_report(
    '2020-01-16',
    'נסעחול30',
    TRUE,
    ('2020-01-16' :: date - '2019-12-15' :: date + 1),
    0
  );

-- Copenhagen 02/2020
SELECT
  *
FROM
  trip_report(
    '2020-02-21',
    'נסעחול32',
    TRUE,
    ('2020-02-21' :: date - '2020-02-18' :: date + 1),
    0
  );

-- France 03/2020
SELECT
  *
FROM
  trip_report(
    '2020-03-06',
    'נסעחול33',
    TRUE,
    ('2020-03-06' :: date - '2020-03-04' :: date + 1),
    0
  );

-- Amsterdam 01/2020
SELECT
  *
FROM
  trip_report(
    '2020-06-20',
    'נסעחול31',
    TRUE,
    ('2020-02-17' :: date - '2020-02-07' :: date + 1) + ('2020-03-03' :: date - '2020-02-22' :: date + 1) + ('2020-06-20' :: date - '2020-03-07' :: date + 1),
    0
  );

-- NYC Cancelled
SELECT
  *
FROM
  trip_report('2020-03-02', 'נסעחול34', TRUE, 0, 0);

SELECT
  *,
  gen_random_uuid() AS id,
  (
    SELECT
      t1.reviewed
    FROM
      accounter_schema.saved_tax_reports_2020_03_04 t1
    WHERE
      COALESCE(t1.invoice_date, '') = COALESCE(t2.invoice_date, '')
      AND COALESCE(t1.debit_account_1, '') = COALESCE(t2.debit_account_1, '')
      AND COALESCE(t1.debit_amount_1, '') = COALESCE(t2.debit_amount_1, '')
      AND COALESCE(t1.foreign_debit_amount_1, '') = COALESCE(t2.foreign_debit_amount_1, '')
      AND COALESCE(t1.currency, '') = COALESCE(t2.currency, '')
      AND COALESCE(t1.credit_account_1, '') = COALESCE(t2.credit_account_1, '')
      AND COALESCE(t1.credit_amount_1, '') = COALESCE(t2.credit_amount_1, '')
      AND COALESCE(t1.foreign_credit_amount_1, '') = COALESCE(t2.foreign_credit_amount_1, '')
      AND COALESCE(t1.debit_account_2, '') = COALESCE(t2.debit_account_2, '')
      AND COALESCE(t1.debit_amount_2, '') = COALESCE(t2.debit_amount_2, '')
      AND COALESCE(t1.foreign_debit_amount_2, '') = COALESCE(t2.foreign_debit_amount_2, '')
      AND COALESCE(t1.credit_account_2, '') = COALESCE(t2.credit_account_2, '')
      AND COALESCE(t1.credit_amount_2, '') = COALESCE(t2.credit_amount_2, '')
      AND COALESCE(t1.foreign_credit_amount_2, '') = COALESCE(t2.foreign_credit_amount_2, '')
      AND COALESCE(t1.details, '') = COALESCE(t2.details, '')
      AND COALESCE(t1.reference_1, 0) = COALESCE(t2.reference_1, 0)
      AND COALESCE(t1.reference_2, '') = COALESCE(t2.reference_2, '')
      AND COALESCE(t1.movement_type, '') = COALESCE(t2.movement_type, '')
      AND COALESCE(t1.value_date, '') = COALESCE(t2.value_date, '')
      AND COALESCE(t1.date_3, '') = COALESCE(t2.date_3, '')
  ) AS reviewed INTO TABLE accounter_schema.saved_tax_reports_2020_03_04_3
FROM
  (
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-03-01')
      ORDER BY
        to_date(date_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-04-01')
      ORDER BY
        to_date(date_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        trip_report(
          '2020-02-21',
          'נסעחול33',
          TRUE,
          ('2020-03-06' :: date - '2020-03-04' :: date + 1),
          0
        )
    )
  ) t2
ORDER BY
  to_date(date_3, 'DD/MM/YYYY'),
  original_id;

SELECT
  user_description,
  bank_description,
  business_trip,
  event_date
FROM
  formatted_merged_tables
WHERE
  tax_category = 'נסעחול28'
ORDER BY
  event_date;

DROP FUNCTION
  trip_report;

-- TODO: Send year as a parameter and adjust to it
CREATE
OR REPLACE FUNCTION trip_report(
  last_date_input VARCHAR,
  trip_name VARCHAR,
  is_higher_country BOOLEAN,
  number_of_days_with_sleep_input FLOAT,
  number_of_days_without_sleep_input FLOAT DEFAULT 0
) RETURNS TABLE (
  invoice_date VARCHAR,
  debit_account_1 VARCHAR,
  debit_amount_1 VARCHAR,
  foreign_debit_amount_1 VARCHAR,
  currency VARCHAR,
  credit_account_1 VARCHAR,
  credit_amount_1 VARCHAR,
  foreign_credit_amount_1 VARCHAR,
  debit_account_2 VARCHAR,
  debit_amount_2 VARCHAR,
  foreign_debit_amount_2 VARCHAR,
  credit_account_2 VARCHAR,
  credit_amount_2 VARCHAR,
  foreign_credit_amount_2 VARCHAR,
  details VARCHAR,
  reference_1 BIGINT,
  reference_2 VARCHAR,
  movement_type VARCHAR,
  value_date VARCHAR,
  date_3 VARCHAR,
  original_id uuid,
  origin TEXT,
  invoice_image TEXT
) LANGUAGE SQL AS $$

with last_day as (
    select last_date_input::date as date
),
     all_exchange_dates as (
         select dt AS     exchange_date,
                (select t1.eur
                 from accounter_schema.exchange_rates t1
                 where date_trunc('day', t1.exchange_date)::date <= times_table.dt
                 order by t1.exchange_date desc
                 limit 1) eur_rate,
                (select t1.usd
                 from accounter_schema.exchange_rates t1
                 where date_trunc('day', t1.exchange_date)::date <= times_table.dt
                 order by t1.exchange_date desc
                 limit 1) usd_rate
         from times_table
         order by dt
     ),
     all_trip_transactions as (
         select *
         from formatted_merged_tables
         where tax_category = trip_name
         order by event_date
     ),
     formatted_trip_transactions as (
         select formatted_event_date                                            as invoice_date,
                tax_category                                                    as debit_account_1,
                formatted_event_amount_in_ils                                   as debit_amount_1,
                formatted_foreign_amount_if_exist                               as foreign_debit_amount_1,
                formatted_currency                                              AS currency,
                formatted_account                                               as credit_account_1,
                formatted_event_amount_in_ils                                   as credit_amount_1,
                formatted_foreign_amount_if_exist                               as foreign_credit_amount_1,
                null                                                            as debit_account_2,
                null                                                            as debit_amount_2,
                null                                                            as foreign_debit_amount_2,
                null                                                            as credit_account_2,
                null                                                            as credit_amount_2,
                null                                                            as foreign_credit_amount_2,
                user_description                                                AS details,
                bank_reference                                                  AS reference_1,
                RIGHT(regexp_replace(tax_invoice_number, '[^0-9]+', '', 'g'), 9) AS reference_2,
                null                                                            as movement_type,
                (CASE
                     WHEN debit_date IS NULL THEN formatted_event_date
                     ELSE formatted_debit_date
                    END)                                                        AS value_date,
                formatted_event_date,
                id as original_id,
                'trip_report' as origin,
                '' as invoice_image
         from all_trip_transactions
     ),
     total_money_for_days as (
         select (number_of_days_with_sleep_input * 81) +
                (number_of_days_without_sleep_input * 136) as total_usd
     ),
     higher_countries as (
         select (case
                     when is_higher_country = true then (total_money_for_days.total_usd / 100) * 125
                     when is_higher_country = false then total_money_for_days.total_usd
             end) as total
         from total_money_for_days
     ),
     exchange_rate as (
         select t1.usd_rate as daily_date
         from all_exchange_dates t1,
              last_day
         where t1.exchange_date::date = last_day.date
     ),
     top_value_date as (
         select max(debit_date) as debit_date
         from formatted_merged_tables
         where tax_category = trip_name
     ),
     total_eshel as (
         select to_char(last_day.date, 'DD/MM/YYYY')                                                 as invoice_date,
                trip_name                                                                            as debit_account_1,
                to_char(float8(higher_countries.total * exchange_rate.daily_date), 'FM999999999.00') as debit_amount_1,
                to_char(float8(higher_countries.total), 'FM999999999.00')                            as foreign_debit_amount_1,
                '$'                                                                                  as currency,
                'אוריח'                                                                              as credit_account_1,
                to_char(float8(higher_countries.total * exchange_rate.daily_date), 'FM999999999.00') as credit_amount_1,
                to_char(float8(higher_countries.total), 'FM999999999.00')                            as foreign_credit_amount_1,
                null                                                                                 as debit_account_2,
                null                                                                                 as debit_amount_2,
                null                                                                                 as foreign_debit_amount_2,
                null                                                                                 as credit_account_2,
                null                                                                                 as credit_amount_2,
                null                                                                                 as foreign_credit_amount_2,
                'אש״ל לא מנוצלות'                                                                      as details,
                null::int                                                                            as reference_1,
                null                                                                                 as reference_2,
                null                                                                                 as movement_type,
                to_char(last_day.date, 'DD/MM/YYYY')                                                 as value_date,
                to_char(top_value_date.debit_date, 'DD/MM/YYYY')                                     as date_3,
                null::uuid                                                                           as original_id,
                'trip_report'                                                                        as origin,
                ''                                                                                   as invoice_image
         from last_day,
              exchange_rate,
              higher_countries,
              top_value_date)
select *
from formatted_trip_transactions
union all
select *
from total_eshel;

$$;