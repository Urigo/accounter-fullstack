 -- Budapest 04/2019
SELECT
  *
FROM
  trip_report (
    '2019-05-20',
    'נסעחול16',
    FALSE,
    ('2019-05-20'::date - '2019-04-30'::date + 1) + ('2019-06-01'::date - '2019-05-29'::date + 1) + ('2019-06-13'::date - '2019-06-04'::date + 1) + ('2019-07-04'::date - '2019-06-28'::date + 1),
    0
  );

-- Amsterdam 08/2019
SELECT
  *
FROM
  trip_report (
    '2019-05-20',
    'נסעחול23',
    TRUE,
    0,
    ('2019-08-14'::date - '2019-08-09'::date + 1) + ('2019-09-09'::date - '2019-08-17'::date + 1)
  );

-- Amsterdam 09/2019
SELECT
  *
FROM
  trip_report (
    '2019-10-15',
    'נסעחול25',
    TRUE,
    ('2019-10-01'::date - '2019-09-21'::date + 1) + ('2019-10-15'::date - '2019-10-04'::date + 1),
    0
  );

-- Copenhagen 10/2019
SELECT
  *
FROM
  trip_report (
    '2019-10-03',
    'נסעחול26',
    TRUE,
    ('2019-10-03'::date - '2019-10-02'::date + 1),
    0
  );

-- Amsterdam 11/2019
SELECT
  *
FROM
  trip_report (
    '2019-11-21',
    'נסעחול27',
    TRUE,
    ('2019-11-21'::date - '2019-10-31'::date + 1),
    0
  );

-- '2019-11-22'::date - '2019-12-04'::date, China 11/2019 28
-- '2019-12-05'::date - ''::date, Japan 11/2019 28
SELECT
  *
FROM
  trip_report (
    '2019-12-09',
    'נסעחול28',
    FALSE,
    1,
    ('2019-12-04'::date - '2019-11-22'::date + 1) - 1
  );

SELECT
  *
FROM
  trip_report (
    '2019-12-09',
    'נסעחול28',
    TRUE,
    0,
    ('2019-12-09'::date - '2019-12-05'::date + 1)
  );

-- Copenhagen 12/2019
SELECT
  *
FROM
  trip_report (
    '2019-12-14',
    'נסעחול29',
    TRUE,
    ('2019-12-14'::date - '2019-12-10'::date + 1),
    0
  );

-- Amsterdam 12/2019
SELECT
  *
FROM
  trip_report (
    '2020-01-16',
    'נסעחול30',
    TRUE,
    ('2020-01-16'::date - '2019-12-15'::date + 1),
    0
  );

-- Copenhagen 02/2020
SELECT
  *
FROM
  trip_report (
    '2020-02-21',
    'נסעחול32',
    TRUE,
    ('2020-02-21'::date - '2020-02-18'::date + 1),
    0
  );

-- France 03/2020
SELECT
  *
FROM
  trip_report (
    '2020-03-06',
    'נסעחול33',
    TRUE,
    ('2020-03-06'::date - '2020-03-04'::date + 1),
    0
  );

-- Amsterdam 01/2020
SELECT
  *
FROM
  trip_report (
    '2020-06-20',
    'נסעחול31',
    TRUE,
    ('2020-02-17'::date - '2020-02-07'::date + 1) + ('2020-03-03'::date - '2020-02-22'::date + 1) + ('2020-06-20'::date - '2020-03-07'::date + 1),
    0
  );

-- NYC Cancelled
SELECT
  *
FROM
  trip_report ('2020-03-02', 'נסעחול34', TRUE, 0, 0);

SELECT
  *,
  gen_random_uuid () AS id,
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
        get_tax_report_of_month ('2020-03-01')
      ORDER BY
        to_date(date_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month ('2020-04-01')
      ORDER BY
        to_date(date_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        trip_report (
          '2020-02-21',
          'נסעחול33',
          TRUE,
          ('2020-03-06'::date - '2020-03-04'::date + 1),
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
OR REPLACE FUNCTION trip_report (
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


 select
event_date,
debit_date,
event_amount,
currency_code,
financial_entity,
user_description,
detailed_bank_description

     from accounter_schema.all_transactions
 where id in (


     );




-- San Francisco 05/2022
United Airlines 04/05 $242
'3312a37e-1d4e-47f1-8db5-20bbda0390c1',
'74c44b6e-36d7-45e4-aedd-5e6c2a616b24',
'fe53745e-d42e-4218-a663-3431c6a47f41',
'acb2e58d-f780-4ee4-ba99-eaec6bc3a82a',
'4b7c422e-e847-4639-98b1-6eb6fa61a58e',
'f255844f-877e-45ee-8641-68cba888daaa',
'7eae50ed-c542-4d6d-b3fa-d10bafb134e3'

Uber Dotan (by card)
'699df516-26be-4f4a-8204-3e2da7534456',
'37c3070c-47e3-4d3a-a4f2-2db1593f91c5',
'214fe0c3-1900-4dae-9358-7d08acdd2259',
'11bcfdf0-298e-44ef-a7c9-ecd213199b05',
'e838c504-321b-4240-8b98-1e15bddad90d',
'fa26bb50-f6ca-40de-8234-86a02492742f',
'cafe47c8-ff72-4a61-afbf-776497fa49ab',
'4a229499-853e-406d-985d-f5667c883cb7',
'172aad5c-f17b-48ef-873b-dba894450c03',
'70d6201f-6b75-46a5-9a4c-503cc9afcb1f'

Food
'e6b90bb8-8b56-44b8-986b-29e01185ebb0',
'5659aed1-1fa5-4804-9ed7-803b9c8b4726',
'00e4ba9e-7fbe-402d-8e02-576bb43159e4',
'9f3a773e-21c4-4b3b-8d7f-df6930026eef',
'edbdf58c-38fd-41a5-9260-177ecd8a4fc5',
'd1c6ae41-4709-4fe6-a14f-ce8491bfb842',
'd83c2fd5-3fde-4ae8-a329-aa8b19cd6136',
'd52d0d7b-b97d-4881-886c-7c955cbb037a',
'1e5d5f93-42a6-4f41-acbc-f4f3ba5c225e',
'5332f113-8ad6-4a83-8ec4-fd43f0e8571e',
'adbbead6-c651-4f9f-b58e-ccd8c6bfe9de',
'f49d04ec-ae50-493b-b773-6a1dfcfc24b7',
'66fc1b90-35bb-4991-b353-698d777f97dc',
'c3ba4923-cab7-4122-983d-1695bc4ef3d7',
'df723b20-83ff-425a-959e-95da2253b1b4',
'deb0fe32-cddf-48a1-b43f-ca764866f567',
'b80b49b9-3760-4ff1-868c-8139d806fc7b'


Dima expenses for trip with invoice
cd4480ee-d87d-4d54-a694-97c7851d7c40


-- San Diego 10/2022
United
8f792055-6a3b-4b86-a447-9c664da427ac
a029b417-14d2-48f1-b7d5-05760b365998
3aef6ead-a444-45db-b8aa-9e1094c16224
4a344fef-f3ab-441a-ae61-2785c14fa821
65621b85-6c05-4c7f-966e-3e051f886ccc

Fedex for conference
f6563fdc-fcee-497d-bea6-409af38430e6


-- Lake Como 11/2022
875a459a-0ef5-4629-905b-d5f77af5a875
38fbf95a-dc11-4283-a62f-cee813c00246
237939a4-d1b3-43ba-ba6c-3854802b7869
e36a5baf-9242-4f6d-957d-fb378cce0ab5
712c3a8e-7f6a-49cd-aa89-7724d514e0ca
845ac520-d3d0-49c3-b3e8-70d82eea6ff3
be349011-ace6-4542-b31f-70751e19c84a
f4386361-fd17-45b8-aa73-836e7519c622
8416a943-86ae-4758-81cf-c77979ba87a6


Uber
7fe6c6ae-a808-4ad2-b4dc-7a6ca493565e
ed0ca4eb-4bf6-41d4-96cf-632241713d94

c93514c5-192c-4374-81de-022f91beba5c
2dcfac7c-15b1-40b7-9e07-632d35ed8671
736b3b05-1637-4c1c-a8dd-01f014cb126a
6b208741-a5fb-49bd-ba06-875102967206

8672a91f-ebc7-4bc2-9866-1733388ac8d7

fd8954bf-8f4a-4574-bea0-c90e61cfd14f

9879b015-d3cf-4c14-ba36-d57be5c3bee6


-- Paris 12/2022
1f2ed8b5-4ecd-465d-a42c-bc577f9bc408
5af49722-fb41-47e2-bed6-d7bae6da9752

030627fc-48c3-45cf-863b-0ca601f2a510
ad3868ff-d62a-43b7-b434-ca073067ff63
fc29eb2e-9877-4e57-ab6c-4567291d7a8c
ae495cbf-2d29-437b-99a0-29ab26d93ff3
bccd772e-57b1-4d2a-b07e-0f5ff4f5d8c1
8a40458d-548f-4222-b938-d1bfb1b9ab6a
f56a7017-b05f-4ebf-97b0-c21c998d3ab9
b6510a24-18d7-4f2c-a620-f5201b44a73c
b49ffb58-ccae-4458-a2cc-153205d2910b
00125ecc-ac91-4870-b4c0-46b7a0c11df2

a666bbbd-17ad-4523-9756-2c2da63941e2
1775a814-eb7e-4fd8-9505-e5b3c04e0a9f
ad521852-7346-4b3e-9a61-98a2264329f3
d4be2d4e-1a7c-429d-9509-2fe9a7d77249
