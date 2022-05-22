SELECT
  *
FROM
  accounter_schema.ledger
WHERE
  hashavshevet_id IS NULL
  AND to_date(date_3, 'DD/MM/YYYY') >= to_date('30/04/2021', 'DD/MM/YYYY')
  AND business = 'a1f66c23-cea3-48a8-9a4b-0b4a0422851a'
ORDER BY
  (to_date(date_3, 'DD/MM/YYYY')),
  original_id,
  invoice_date;

SELECT
  hash_index,
  auto_tax_category
FROM
  accounter_schema.hash_business_indexes
WHERE
  business = $$5b7b0977-2c6f-4b26-93d9-d90c1698edcc$$
  AND hash_owner = $$6a20aa69-57ff-446e-8d6a-1e96d095e988$$;

SELECT
  hashavshevet.*
FROM
  accounter_schema.ledger hashavshevet
WHERE
  origin = 'manual_salary'
  AND to_date(hashavshevet.invoice_date, 'DD/MM/YYYY') >= date_trunc('month', '2020-07-01' :: date);

UPDATE
  accounter_schema.isracard_creditcard_transactions
SET
  full_purchase_date_outbound = to_char(
    to_date(full_purchase_date_outbound, 'YYYY-MM-DD'),
    'DD/MM/YYYY'
  )
WHERE
  full_purchase_date_outbound IS NOT NULL;

UPDATE
  accounter_schema.isracard_creditcard_transactions
SET
  full_purchase_date = to_char(
    to_date(full_purchase_date, 'YYYY-MM-DD'),
    'DD/MM/YYYY'
  )
WHERE
  full_purchase_date IS NOT NULL;

UPDATE
  accounter_schema.isracard_creditcard_transactions
SET
  full_payment_date = to_char(
    to_date(full_payment_date, 'YYYY-MM-DD'),
    'DD/MM/YYYY'
  )
WHERE
  full_payment_date IS NOT NULL;

SELECT
  count(*)
FROM
  accounter_schema.poalim_ils_account_transactions
WHERE
  poalim_ils_account_transactions.hashavshevet_id IS NOT NULL;

SELECT
  count(*)
FROM
  accounter_schema.all_transactions
WHERE
  all_transactions.hashavshevet_id IS NOT NULL
  AND account_type = 'checking_ils';

SELECT
  to_char(
    to_date(full_purchase_date_outbound, 'YYYY-MM-DD'),
    'DD/MM/YYYY'
  )
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  full_purchase_date_outbound IS NOT NULL
ORDER BY
  full_purchase_date_outbound :: date;

SELECT
  hashavshevet.*
FROM
  accounter_schema.ledger hashavshevet
  LEFT JOIN formatted_merged_tables bank ON hashavshevet.original_id = bank.id
WHERE
  (
    hashavshevet.original_id IS NULL
    AND to_date(hashavshevet.invoice_date, 'DD/MM/YYYY') >= date_trunc('month', '2020-09-01' :: date)
    AND to_date(hashavshevet.invoice_date, 'DD/MM/YYYY') <= (
      date_trunc('month', '2020-09-01' :: date) + INTERVAL '1 month' - INTERVAL '1 day'
    ) :: date
  )
  OR (
    bank.business_trip IS NULL
    AND (
      bank.account_number = 2733
      OR bank.account_number = 61066
    )
    AND (
      (
        (
          bank.financial_entity != 'Isracard'
          OR bank.financial_entity IS NULL
        )
        AND bank.account_type != 'creditcard'
        AND bank.event_date :: TEXT :: date >= date_trunc('month', '2020-09-01' :: date)
        AND bank.event_date :: TEXT :: date <= (
          date_trunc('month', '2020-09-01' :: date) + INTERVAL '1 month' - INTERVAL '1 day'
        ) :: date
        OR bank.event_date IS NULL
      )
      OR (
        (
          bank.account_type = 'creditcard'
          OR bank.financial_entity = 'Isracard'
        )
        AND (
          bank.debit_date :: TEXT :: date <= get_creditcard_charge_date('2020-09-01') :: date
          AND bank.debit_date :: TEXT :: date > get_creditcard_charge_date_former_month('2020-09-01') :: date
          OR (
            bank.debit_date IS NULL
            AND bank.event_date :: TEXT :: date >= date_trunc('month', '2020-09-01' :: date)
            AND bank.event_date :: TEXT :: date <= (
              date_trunc('month', '2020-09-01' :: date) + INTERVAL '1 month' - INTERVAL '1 day'
            ) :: date
          )
        )
      )
    )
  )
ORDER BY
  to_date(date_3, 'DD/MM/YYYY'),
  original_id,
  details,
  debit_account_1;

SELECT
  gen_random_uuid();

SELECT
  gen_random_uuid();

SELECT
  gen_random_uuid();

SELECT
  gen_random_uuid();

SELECT
  gen_random_uuid();

SELECT
  gen_random_uuid();

SELECT
  gen_random_uuid();

UPDATE
  accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
SET
  id = gen_random_uuid()
WHERE
  id IS NULL;

SELECT
  *
FROM
  report_to_hashavshevet_by_month('2020-09-01');

SELECT
  *
FROM
  accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
WHERE
  hashavshevet_id IS NULL
  AND to_date(date_3, 'DD/MM/YYYY') >= to_date('01/10/2020', 'DD/MM/YYYY')
ORDER BY
  (to_date(date_3, 'DD/MM/YYYY'));

DROP FUNCTION report_to_hashavshevet_by_month(month_report VARCHAR);

CREATE
OR REPLACE FUNCTION report_to_hashavshevet_by_month(month_report VARCHAR) RETURNS TABLE(
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
  proforma_invoice_file TEXT,
  id uuid,
  reviewed BOOLEAN,
  hashavshevet_id INT
) LANGUAGE SQL AS $$

select hashavshevet.*
from accounter_schema.ledger hashavshevet
left join formatted_merged_tables bank on hashavshevet.original_id = bank.id
where
    (hashavshevet.original_id is null and
     to_date(hashavshevet.invoice_date, 'DD/MM/YYYY') >= date_trunc('month', month_report::date) and
     to_date(hashavshevet.invoice_date, 'DD/MM/YYYY') <= (date_trunc('month', month_report::date) + interval '1 month' - interval '1 day')::date
    ) or (
    bank.business_trip is null and
    (bank.account_number = 2733 OR bank.account_number = 61066) AND
        (((bank.financial_entity != 'Isracard' OR bank.financial_entity IS NULL) AND
            bank.account_type != 'creditcard' AND
            bank.event_date::text::date >= date_trunc('month', month_report::date) AND
            bank.event_date::text::date <= (date_trunc('month', month_report::date) + interval '1 month' - interval '1 day')::date OR
            bank.event_date IS NULL)
        OR (
            (bank.account_type = 'creditcard' OR bank.financial_entity = 'Isracard') AND
             (
                   bank.debit_date::text::date <= get_creditcard_charge_date(month_report)::date AND bank.debit_date::text::date > get_creditcard_charge_date_former_month(month_report)::date OR
                   (bank.debit_date IS NULL AND bank.event_date::text::date >= date_trunc('month', month_report::date) AND
                    bank.event_date::text::date <= (date_trunc('month', month_report::date) + interval '1 month' - interval '1 day')::date)
             ))))
order by to_date(date_3, 'DD/MM/YYYY'), original_id, details, debit_account_1;

$$;

SELECT
  *
FROM
  get_unified_tax_report_of_month(
    'Software Products Guilda Ltd.',
    '2020-01-01',
    '2021-05-01'
  )
ORDER BY
  to_date(date_3, 'DD/MM/YYYY') DESC,
  original_id,
  details,
  debit_account_1,
  id;

DROP FUNCTION get_unified_tax_report_of_month;

CREATE
OR REPLACE FUNCTION get_unified_tax_report_of_month(
  business_name TEXT,
  month_start VARCHAR,
  month_end VARCHAR
) RETURNS TABLE(
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
  proforma_invoice_file TEXT,
  id uuid,
  reviewed BOOLEAN,
  hashavshevet_id INT
) LANGUAGE SQL AS $$


(
select hashavshevet.invoice_date,
       hashavshevet.debit_account_1,
       hashavshevet.debit_amount_1,
       hashavshevet.foreign_debit_amount_1,
       hashavshevet.currency,
       hashavshevet.credit_account_1,
       hashavshevet.credit_amount_1,
       hashavshevet.foreign_credit_amount_1,
       hashavshevet.debit_account_2,
       hashavshevet.debit_amount_2,
       hashavshevet.foreign_debit_amount_2,
       hashavshevet.credit_account_2,
       hashavshevet.credit_amount_2,
       hashavshevet.foreign_credit_amount_2,
       hashavshevet.details,
       hashavshevet.reference_1,
       hashavshevet.reference_2,
       hashavshevet.movement_type,
       hashavshevet.value_date,
       hashavshevet.date_3,
       hashavshevet.original_id,
       hashavshevet.origin,
       hashavshevet.proforma_invoice_file,
       hashavshevet.id,
       hashavshevet.reviewed,
       hashavshevet.hashavshevet_id
from accounter_schema.ledger hashavshevet
left outer join accounter_schema.all_transactions bank on hashavshevet.original_id = bank.id
where
    (bank is null and business = (
    select id
    from accounter_schema.businesses
    where name = business_name
)) or (
    (bank.account_number in (select account_number
from accounter_schema.financial_accounts
where owner = (
    select id
    from accounter_schema.businesses
    where name = business_name
))) AND
        (((bank.financial_entity != 'Isracard' OR bank.financial_entity IS NULL) AND
            bank.account_type != 'creditcard' AND
            bank.event_date::text::date >= date_trunc('month', month_start::date) AND
            bank.event_date::text::date <= (date_trunc('month', month_end::date) + interval '1 month' - interval '1 day')::date OR
            bank.event_date IS NULL)
        OR (
            (bank.account_type = 'creditcard' OR bank.financial_entity = 'Isracard') AND
            ((
                   bank.debit_date::text::date <= COALESCE(get_creditcard_charge_date(month_end)::date, (date_trunc('month', month_end::date) + interval '1 month' - interval '1 day')::date) AND bank.debit_date::text::date > get_creditcard_charge_date_former_month(month_start)::date OR
                   (bank.debit_date IS NULL AND bank.event_date::text::date >= date_trunc('month', month_start::date) AND
                    bank.event_date::text::date <= (date_trunc('month', month_end::date) + interval '1 month' - interval '1 day')::date)
             ) or (
                 get_creditcard_charge_date(month_end) is null and
                 bank.debit_date::text::date > month_end::date
             ))
        )))
--         and (bank.reviewed is false or bank.reviewed is null)
    )
UNION ALL
(select
       formatted_event_date as invoice_date,
       formatted_account as debit_account_1,
       concat(event_amount::text, ' ', currency_code) as debit_amount_1,
       bank_description as foreign_debit_amount_1,
       '' as currency,
       formatted_financial_entity as credit_account_1,
       tax_category as credit_amount_1,
       to_char(current_balance, 'FM999999999.00') as foreign_credit_amount_1,
       '' as debit_account_2,
       '' as debit_amount_2,
       '' as foreign_debit_amount_2,
       '' as credit_account_2,
       '' as credit_amount_2,
       id::text as foreign_credit_amount_2,
       '0' as details,
       bank_reference as reference_1,
       to_char(tax_invoice_date, 'DD/MM/YYYY') as reference_2,
       vat::text as movement_type,
       to_char(debit_date, 'DD/MM/YYYY') as value_date,
       formatted_event_date as date_3,
       id::uuid as original_id,
       'bank' as origin,
       proforma_invoice_file,
       id as id,
       reviewed,
       hashavshevet_id
from formatted_merged_tables
where
    (account_number in (select account_number
from accounter_schema.financial_accounts
where owner = (
    select id
    from accounter_schema.businesses
    where name = business_name
))) AND
        (((financial_entity != 'Isracard' OR financial_entity IS NULL) AND
            account_type != 'creditcard' AND
            event_date::text::date >= date_trunc('month', month_start::date) AND
            event_date::text::date <= (date_trunc('month', month_end::date) + interval '1 month' - interval '1 day')::date OR
            event_date IS NULL)
        OR (
            (account_type = 'creditcard' OR financial_entity = 'Isracard') AND
             ((
                   debit_date::text::date <= get_creditcard_charge_date(month_end)::date AND debit_date::text::date > get_creditcard_charge_date_former_month(month_start)::date OR
                   (debit_date IS NULL AND event_date::text::date >= date_trunc('month', month_start::date) AND
                    event_date::text::date <= (date_trunc('month', month_end::date) + interval '1 month' - interval '1 day')::date)
             ) or (
                 get_creditcard_charge_date(month_end) is null and
                 debit_date::text::date <= (date_trunc('month', month_end::date) + interval '1 month' - interval '1 day')::date
             ))
        ))
--   and (reviewed is false or reviewed is null)
)

$$;

SELECT
  account_number
FROM
  accounter_schema.financial_accounts
WHERE
  OWNER = (
    SELECT
      id
    FROM
      accounter_schema.businesses
    WHERE
      NAME = 'Uri Goldshtein LTD'
  );

-- Merge and insert new transactions into existing table
SELECT
  *,
  gen_random_uuid() AS id,
  (
    SELECT
      t1.reviewed
    FROM
      accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08 t1
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
  ) AS reviewed,
  (
    SELECT
      t1.hashavshevet_id
    FROM
      accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08 t1
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
  ) AS hashavshevet_id INTO TABLE accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
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
        get_tax_report_of_month('2020-05-01')
      ORDER BY
        to_date(date_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-06-01')
      ORDER BY
        to_date(date_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-07-01')
      ORDER BY
        to_date(date_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-08-01')
      ORDER BY
        to_date(date_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-09-01')
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
          '2020-06-20',
          'נסעחול31',
          TRUE,
          ('2020-02-17' :: date - '2020-02-07' :: date + 1) + ('2020-03-03' :: date - '2020-02-22' :: date + 1) + ('2020-06-20' :: date - '2020-03-07' :: date + 1),
          0
        )
    )
    UNION ALL
    (
      SELECT
        invoice_date,
        debit_account_1,
        debit_amount_1,
        foreign_debit_amount_1,
        currency,
        credit_account_1,
        credit_amount_1,
        foreign_credit_amount_1,
        debit_account_2,
        debit_amount_2,
        foreign_debit_amount_2,
        credit_account_2,
        credit_amount_2,
        foreign_credit_amount_2,
        details,
        reference_1,
        reference_2,
        movement_type,
        value_date,
        date_3,
        original_id,
        origin,
        proforma_invoice_file
      FROM
        accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08
      WHERE
        origin = 'manual_salary'
    )
  ) t2
ORDER BY
  to_date(date_3, 'DD/MM/YYYY'),
  original_id;

-- TODO: Reuse logic of getting business month from the initial query
-- TODO: Reuse logic of what is deductible
WITH this_month_business AS (
  SELECT
    *
  FROM
    formatted_merged_tables
  WHERE
    business_trip IS NULL
    AND (
      account_number = 2733
      OR account_number = 61066
    )
    AND (
      (
        (
          financial_entity != 'Isracard'
          OR financial_entity IS NULL
        )
        AND account_type != 'creditcard'
        AND event_date :: TEXT :: date >= date_trunc('month', '2020-08-01' :: date)
        AND event_date :: TEXT :: date <= (
          date_trunc('month', '2020-08-01' :: date) + INTERVAL '1 month' - INTERVAL '1 day'
        ) :: date
        OR event_date IS NULL
      )
      OR (
        (
          account_type = 'creditcard'
          OR financial_entity = 'Isracard'
        )
        AND (
          debit_date :: TEXT :: date <= get_creditcard_charge_date('2020-08-01') :: date
          AND debit_date :: TEXT :: date > get_creditcard_charge_date_former_month('2020-08-01') :: date
          OR (
            debit_date IS NULL
            AND event_date :: TEXT :: date >= date_trunc('month', '2020-08-01' :: date)
            AND event_date :: TEXT :: date <= (
              date_trunc('month', '2020-08-01' :: date) + INTERVAL '1 month' - INTERVAL '1 day'
            ) :: date
          )
        )
      )
    )
)
SELECT
  (
    (
      sum(
        formatted_invoice_amount_in_ils_with_vat_if_exists :: FLOAT
      ) / 100
    ) * 3.5
  ) :: INT advance,
  (
    sum(
      formatted_invoice_amount_in_ils_with_vat_if_exists :: FLOAT
    )
  ) :: INT total
FROM
  this_month_business
WHERE
  event_amount > 0
  AND financial_entity != 'Isracard'
  AND financial_entity != 'Tax'
  AND financial_entity != 'VAT'
  AND financial_entity != 'Uri Goldshtein Employee Tax Withholding'
  AND financial_entity != 'Uri Goldshtein'
  AND financial_entity != 'Uri Goldshtein Employee Social Security'
  AND financial_entity != 'Tax Corona Grant'
  AND financial_entity != 'Uri Goldshtein Hoz'
  AND financial_entity != 'VAT interest refund'
  AND financial_entity != 'Tax Shuma'
  AND is_conversion <> TRUE;

INSERT INTO
  accounter_schema.ledger (
    invoice_date,
    debit_account_1,
    debit_amount_1,
    foreign_debit_amount_1,
    currency,
    credit_account_1,
    credit_amount_1,
    foreign_credit_amount_1,
    debit_account_2,
    debit_amount_2,
    foreign_debit_amount_2,
    credit_account_2,
    credit_amount_2,
    foreign_credit_amount_2,
    details,
    reference_1,
    reference_2,
    movement_type,
    value_date,
    date_3,
    original_id,
    origin,
    proforma_invoice_file,
    id
  )
SELECT
  *,
  gen_random_uuid() -- into table accounter_schema.saved_tax_reports_2020_03_04
FROM
  get_tax_report_of_month('2020-12-01') -- order by to_date(date_3, 'DD/MM/YYYY'), original_id
;

SELECT
  *
FROM
  get_tax_report_of_month('2020-12-01');

DROP FUNCTION get_tax_report_of_month(month_input VARCHAR);

CREATE
OR REPLACE FUNCTION get_tax_report_of_month(month_input VARCHAR) RETURNS TABLE(
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
  proforma_invoice_file TEXT
) LANGUAGE SQL AS $$



WITH this_month_business AS (
SELECT *
FROM formatted_merged_tables
WHERE
    business_trip IS NULL AND
    (account_number = 2733 OR account_number = 61066) AND
        (((financial_entity != 'Isracard' OR financial_entity IS NULL) AND
            account_type != 'creditcard' AND
            event_date::text::date >= date_trunc('month', month_input::date) AND
            event_date::text::date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date OR
            event_date IS NULL)
        OR (
            (account_type = 'creditcard' OR financial_entity = 'Isracard') AND
             (
                   debit_date::text::date <= get_creditcard_charge_date(month_input)::date AND debit_date::text::date > get_creditcard_charge_date_former_month(month_input)::date OR
                   (debit_date IS NULL AND event_date::text::date >= date_trunc('month', month_input::date) AND
                    event_date::text::date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date)
             )))
), full_report_selection as (
    SELECT
        (CASE
            WHEN side = 0 THEN
                (CASE
                    WHEN (financial_entity = 'Poalim' OR financial_entity = 'Isracard')
                        THEN formatted_event_date
                    ELSE formatted_tax_invoice_date
                END)
            ELSE
                formatted_event_date
        END) AS invoice_date,
        (CASE WHEN event_amount < 0 THEN
            (CASE WHEN side = 0 THEN
                formatted_tax_category
                ELSE formatted_financial_entity
            END) ELSE
            (CASE WHEN side = 0 THEN
                formatted_financial_entity
                ELSE formatted_account
            END)
        END) AS debit_account_1,
        (CASE WHEN event_amount < 0 THEN
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_if_exists
                ELSE formatted_event_amount_in_ils_with_interest
            END) ELSE
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_with_vat_if_exists
                ELSE formatted_event_amount_in_ils
            END)
        END) AS debit_amount_1,
        (CASE
            WHEN side = 0 THEN formatted_invoice_foreign_amount_if_exist
            ELSE formatted_foreign_amount_if_exist
        END) AS foreign_debit_amount_1,
        formatted_currency AS currency,
        (CASE WHEN event_amount < 0 THEN
           (CASE
              WHEN side = 0 THEN formatted_financial_entity
              ELSE formatted_account
           END) ELSE
           (CASE
               WHEN side = 0 THEN formatted_tax_category
               ELSE formatted_financial_entity
           END)
        END) AS credit_account_1,
        (CASE WHEN event_amount > 0 THEN
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_if_exists
                ELSE formatted_event_amount_in_ils_with_interest
            END) ELSE
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_with_vat_if_exists
                ELSE formatted_event_amount_in_ils
            END)
        END) AS credit_amount_1,
        (CASE
            WHEN side = 0 THEN formatted_invoice_foreign_amount_if_exist
            ELSE formatted_foreign_amount_if_exist
        END) AS foreign_credit_amount_1,
        (CASE
            WHEN (side = 0 AND event_amount < 0 AND vat <> 0) THEN 'תשו'
            when (side = 1 and event_amount < 0 and interest <> 0) THEN 'הכנרבמ'
--             ELSE NULL
            END
        ) AS debit_account_2,
         (case
            when currency_code = 'ILS' then
                 (CASE
                    WHEN (side = 0 AND event_amount < 0) THEN (CASE WHEN vat <> 0 THEN to_char(float8 (ABS(
                        (case
                            when tax_category = 'פלאפון' then ((vat::float/3)*2)
                            when tax_category = 'מידע' then ((vat::float/3)*2)
                        else vat
                        end)
                        )), 'FM999999999.00') END)
                    when (side = 1 and event_amount < 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
            else
                (CASE
                    WHEN (side = 0 AND event_amount < 0) THEN
                        (CASE WHEN vat <> 0 THEN
                            to_char(float8 (ABS(formatted_foreign_vat_in_ils)), 'FM999999999.00')
                        END)
                    when (side = 1 and event_amount < 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
        end) AS debit_amount_2,
        (case when (side = 0 and event_amount < 0) then to_char(float8 (abs(formatted_foreign_vat)), 'FM999999999.00')
        end) AS foreign_debit_amount_2,
        (CASE
            WHEN (side = 0 AND event_amount > 0 AND vat <> 0) THEN 'עסק'
            when (side = 1 and event_amount > 0 and interest <> 0) THEN 'הכנרבמ'
--             ELSE NULL
            END
        ) AS credit_account_2,
        (case
            when currency_code = 'ILS' then
                (CASE
                    WHEN (side = 0 AND event_amount > 0) THEN (CASE WHEN vat <> 0 THEN to_char(float8 (ABS(vat)), 'FM999999999.00') END)
                    when (side = 1 and event_amount > 0 and interest <> 0)
                        then to_char(float8 (ABS(interest)), 'FM999999999.00')
        --             ELSE NULL
                 END)
            else
                (CASE
                    WHEN (side = 0 AND event_amount > 0) THEN
                        (CASE WHEN vat <> 0 THEN
                            to_char(float8 (ABS(formatted_foreign_vat_in_ils)), 'FM999999999.00')
                        END)
                    when (side = 1 and event_amount > 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
        end) AS credit_amount_2,
        (case when (side = 0 and event_amount > 0) then to_char(float8 (abs(formatted_foreign_vat)), 'FM999999999.00')
        end) AS foreign_credit_amount_2,
        user_description AS details,
        bank_reference AS reference_1,
        RIGHT(regexp_replace(tax_invoice_number, '[^0-9]+', '', 'g'), 9) AS reference_2,
        (CASE
            WHEN side = 0 THEN
                (CASE WHEN event_amount < 0 THEN
                    (CASE
                        WHEN currency_code = 'ILS' THEN
                            (CASE
                                WHEN financial_entity = 'Hot Mobile' THEN 'פלא'
                                WHEN vat <> 0 THEN 'חס'
                                ELSE NULL
                            END)
                        ELSE ''
                    END)
                ELSE
                    (CASE
                        WHEN vat <> 0 THEN 'חל'
                        ELSE 'הכפ'
                    END)
                END)
--             ELSE NULL
            END
        ) AS movement_type,
       (case
           when (tax_invoice_date is not null and account_type != 'creditcard' and side = 0) then formatted_tax_invoice_date
           else (CASE
                    WHEN debit_date IS NULL THEN formatted_event_date
                    ELSE formatted_debit_date
                END)
       end) as value_date,
        formatted_event_date AS date_3,
        formatted_invoice_amount_in_ils_if_exists,
        formatted_event_amount_in_ils,
        formatted_financial_entity,
        event_amount,
        account_type,
        vat,
        tax_invoice_date,
        financial_entity,
        side,
        is_conversion,
        tax_invoice_amount,
        currency_rate,
        personal_category,
        currency_code,
        contra_currency_code,
        debit_date,
        proforma_invoice_file,
        id,
        formatted_tax_category
    FROM this_month_business, generate_series(0,1) as side /* 0 = Entities, 1 = Accounts */
), two_sides as (
    SELECT
        invoice_date,
        debit_account_1,
        debit_amount_1,
        foreign_debit_amount_1,
        currency,
        credit_account_1,
        credit_amount_1,
        foreign_credit_amount_1,
        debit_account_2,
        debit_amount_2,
        foreign_debit_amount_2,
        credit_account_2,
        credit_amount_2,
        foreign_credit_amount_2,
        details,
        reference_1,
        reference_2,
        movement_type,
        value_date,
        date_3,
        id as original_id,
        concat('two_sides - ', side) as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
        financial_entity != 'Isracard' AND
        financial_entity != 'Tax' AND
        financial_entity != 'VAT' AND
        financial_entity != 'Uri Goldshtein Employee Tax Withholding' AND
        financial_entity != 'Uri Goldshtein' AND
        financial_entity != 'Uri Goldshtein Employee Social Security' AND
        financial_entity != 'Tax Corona Grant' AND
        financial_entity != 'Uri Goldshtein Hoz' AND
        formatted_tax_category != 'אוריח' AND
        financial_entity != 'VAT interest refund' AND
        financial_entity != 'Tax Shuma' AND
        is_conversion <> TRUE
), one_side as (
    SELECT
        invoice_date,
        debit_account_1,
        debit_amount_1,
        foreign_debit_amount_1,
        currency,
        credit_account_1,
        credit_amount_1,
        foreign_credit_amount_1,
        debit_account_2,
        debit_amount_2,
        foreign_debit_amount_2,
        credit_account_2,
        credit_amount_2,
        foreign_credit_amount_2,
        details,
        reference_1,
        reference_2,
        movement_type,
        value_date,
        date_3,
        id as original_id,
        concat('one_side - ', side) as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
       (financial_entity = 'Uri Goldshtein' OR
        financial_entity = 'Tax' OR
        financial_entity = 'VAT' OR
        financial_entity = 'Uri Goldshtein Employee Social Security' OR
        financial_entity = 'Isracard' OR
        financial_entity = 'Uri Goldshtein Employee Tax Withholding' OR
        financial_entity = 'Tax Corona Grant' OR
        financial_entity = 'Uri Goldshtein Hoz' or
        formatted_tax_category = 'אוריח' or
        financial_entity = 'VAT interest refund' or
        financial_entity = 'Tax Shuma') AND
       side = 1
), conversions as (
    SELECT
        invoice_date,
        (CASE WHEN event_amount > 0 THEN debit_account_1 END) as debit_account_1,
        (CASE WHEN event_amount > 0 THEN debit_amount_1 END) as debit_amount_1,
        (CASE WHEN event_amount > 0 THEN foreign_debit_amount_1 END) as foreign_debit_amount_1,
        currency,
        (CASE WHEN event_amount < 0 THEN credit_account_1 END) as credit_account_1,
        (CASE WHEN event_amount < 0 THEN credit_amount_1 END) as credit_amount_1,
        (CASE WHEN event_amount < 0 THEN foreign_credit_amount_1 END) as מטח_זכות_חובה_1,
        '' AS debit_account_2,
        '' AS debit_amount_2,
        '' AS foreign_debit_amount_2,
        '' AS credit_account_2,
        '' AS credit_amount_2,
        '' AS foreign_credit_amount_2,
        details,
        reference_1,
        '' AS reference_2,
        '' AS movement_type,
        value_date,
        date_3,
        id as original_id,
        'conversions' as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
         is_conversion IS TRUE AND
         side = 1
), conversions_fees as (
    SELECT
        invoice_date,
        'שער' as debit_account_1,
        to_char(float8 (CASE WHEN event_amount > 0 THEN
            ((
                select credit_amount_1
                from full_report_selection t1
                where
                    t1.is_conversion is true and
                    side = 1 and
                    reference_1 = t1.reference_1 and
                    t1.event_amount < 0
            )::float - debit_amount_1::float)
        END), 'FM999999999.00') as debit_amount_1,
        '' as foreign_debit_amount_1,
        '' as currency,
        '' as credit_account_1,
        '' as credit_amount_1,
        '' as מטח_זכות_חובה_1,
        '' AS debit_account_2,
        '' AS debit_amount_2,
        '' AS foreign_debit_amount_2,
        '' AS credit_account_2,
        '' AS credit_amount_2,
        '' AS foreign_credit_amount_2,
        details,
        reference_1,
        '' AS reference_2,
        '' AS movement_type,
        value_date,
        date_3,
        id as original_id,
        'conversions_fees' as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
         is_conversion IS TRUE AND
         side = 1 and
         event_amount > 0
), invoice_rates_change as (
    SELECT
            invoice_date AS invoice_date,
            'שער' AS debit_account_1,
            to_char(float8 (
                -- TODO: Remove this when we suport currency on invoice_amount
                (case
                    when financial_entity = 'Uri Goldshtein' then tax_invoice_amount::float - formatted_event_amount_in_ils::float
                    when (tax_invoice_amount IS NOT NULL AND tax_invoice_amount <> 0 AND ABS(tax_invoice_amount) <> event_amount)
                        then (formatted_invoice_amount_in_ils_if_exists::float - (CASE
                                        WHEN currency_code = 'EUR' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.eur_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                        WHEN currency_code = 'USD' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.usd_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                    END)
                            ) - formatted_event_amount_in_ils::float
                    else formatted_invoice_amount_in_ils_if_exists::float - formatted_event_amount_in_ils::float
                   end))*-1
                , 'FM999999999.00') as debit_amount_1,
            '' AS foreign_debit_amount_1,
            '' AS currency,
            (case
                when financial_entity = 'Poalim' then ''
                else formatted_financial_entity
            end) AS credit_account_1,
            (case
                when financial_entity = 'Poalim' then ''
                else to_char(float8 (
                    (case
                    when financial_entity = 'Uri Goldshtein' then tax_invoice_amount::float - formatted_event_amount_in_ils::float

                    when (tax_invoice_amount IS NOT NULL AND tax_invoice_amount <> 0 AND ABS(tax_invoice_amount) <> event_amount)

                        then (formatted_invoice_amount_in_ils_if_exists::float - (CASE
                                        WHEN currency_code = 'EUR' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.eur_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                        WHEN currency_code = 'USD' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.usd_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                    END)
                            ) - formatted_event_amount_in_ils::float


                    else formatted_invoice_amount_in_ils_if_exists::float - formatted_event_amount_in_ils::float
                   end)
                    )*-1, 'FM999999999.00')
            end) as credit_amount_1,
            '' AS foreign_credit_amount_1,
            '' AS debit_account_2,
            '' AS debit_amount_2,
            '' AS foreign_debit_amount_2,
            '' AS credit_account_2,
            '' AS credit_amount_2,
            '' AS foreign_credit_amount_2,
            details AS details,
            reference_1 AS reference_1,
            reference_2 AS reference_2,
            '' AS movement_type,
           value_date AS value_date,
           date_3 AS date_3,
           id as original_id,
           'invoice_rates_change' as origin,
           proforma_invoice_file
    FROM full_report_selection
    WHERE
         (
         (tax_invoice_date <> debit_date and
        (select all_exchange_dates.usd_rate
         from all_exchange_dates
         where all_exchange_dates.exchange_date = debit_date::text::date) <> (
         select all_exchange_dates.usd_rate
         from all_exchange_dates
         where all_exchange_dates.exchange_date = tax_invoice_date::text::date))
         or
          (
            financial_entity = 'Uri Goldshtein' and
            (tax_invoice_amount::float - formatted_event_amount_in_ils::float) <> 0
          )
         ) and
         account_type != 'creditcard' and
         currency_code != 'ILS' and
         side = 0
), transfer_fees as (
    SELECT
            formatted_event_date AS invoice_date,
            'עמל' AS debit_account_1,
            to_char(float8 (CASE
                WHEN currency_code = 'EUR' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
            END), 'FM999999999.00') AS debit_amount_1,
            to_char(float8 (ABS(tax_invoice_amount) - event_amount), 'FM999999999.00') AS foreign_debit_amount_1,
            formatted_currency AS currency,
            financial_entity AS credit_account_1,
            to_char(float8 (CASE
                WHEN currency_code = 'EUR' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
            END), 'FM999999999.00') AS credit_amount_1,
            to_char(float8 (ABS(tax_invoice_amount) - event_amount), 'FM999999999.00') AS foreign_credit_amount_1,
            '' AS debit_account_2,
            '' AS debit_amount_2,
            '' AS foreign_debit_amount_2,
            '' AS credit_account_2,
            '' AS credit_amount_2,
            '' AS foreign_credit_amount_2,
            user_description AS details,
            bank_reference AS reference_1,
            '' AS reference_2,
            '' AS movement_type,
           formatted_debit_date AS value_date,
           formatted_event_date AS date_3,
           id as original_id,
           'transfer_fees' as origin,
           proforma_invoice_file
    FROM this_month_business
    WHERE
         tax_invoice_amount IS NOT NULL AND
         tax_invoice_amount <> 0 AND
         ABS(tax_invoice_amount) <> event_amount AND
         currency_code != 'ILS' and
         financial_entity != 'Uri Goldshtein' -- TODO: Until handling tax invoice currency
), withholding_tax as (
    SELECT
            formatted_event_date AS invoice_date,
            'ניבמלק' AS debit_account_1,
            to_char(float8 (ABS(tax_invoice_amount + COALESCE(vat, 0)) - event_amount), 'FM999999999.00') AS debit_amount_1,
            null,
            formatted_currency AS currency,
            financial_entity AS credit_account_1,
            to_char(float8 (ABS(tax_invoice_amount + COALESCE(vat, 0)) - event_amount), 'FM999999999.00') AS credit_amount_1,
            null AS foreign_credit_amount_1,
            '' AS debit_account_2,
            '' AS debit_amount_2,
            '' AS foreign_debit_amount_2,
            '' AS credit_account_2,
            '' AS credit_amount_2,
            '' AS foreign_credit_amount_2,
            user_description AS details,
            bank_reference AS reference_1,
            tax_invoice_number AS reference_2,
            '' AS movement_type,
           formatted_debit_date AS value_date,
           formatted_event_date AS date_3,
           id as original_id,
           'withholding_tax' as origin,
           proforma_invoice_file
    FROM this_month_business
    WHERE
         tax_invoice_amount IS NOT NULL AND
         tax_invoice_amount <> 0 AND
         ABS(tax_invoice_amount) <> event_amount AND
         withholding_tax IS NOT NULL
), all_vat_for_previous_month as (
    SELECT
       SUM(vat) as amount
    FROM
         merged_tables
    WHERE
         event_date::text::date >= (date_trunc('month', month_input::date) - interval '1 month')::date AND
         event_date::text::date <= (date_trunc('month', month_input::date) - interval '1 day')::date
), all_vat_to_recieve_for_previous_month as ( /* מעמ תשומות */
    SELECT
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS invoice_date,
       'מעמחוז' AS debit_account_1,
       to_char(float8 (ABS( SUM(real_vat)))  , 'FM999999999.00') AS debit_amount_1,
       NULL AS foreign_debit_amount_1,
       NULL AS currency,
       'תשו' AS credit_account_1,
       to_char(float8 (ABS( SUM(real_vat)))  , 'FM999999999.00') AS credit_amount_1,
       NULL AS foreign_credit_amount_1,
       NULL AS debit_account_2,
       NULL AS debit_amount_2,
       NULL AS foreign_debit_amount_2,
       NULL AS credit_account_2,
       NULL AS credit_amount_2,
       NULL AS foreign_credit_amount_2,
       concat('פקודת מע״מ ', to_char( date_trunc('month', month_input::date)::date , 'MM/YYYY')) as details,
       NULL::integer AS reference_1,
       NULL AS reference_2,
       NULL AS movement_type,
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS value_date,
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS date_3,
       null::uuid as original_id,
       'all_vat_to_recieve_for_previous_month' as origin,
       ''
    FROM
         formatted_merged_tables
    WHERE
         event_date::text::date >= (date_trunc('month', month_input::date))::date AND
         event_date::text::date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date AND
         vat > 0
), all_vat_to_pay_for_previous_month as ( /* מעמ עסקאות */
    SELECT
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS invoice_date,
       'עסק' AS debit_account_1,
       to_char(float8 (ABS( SUM(real_vat)))  , 'FM999999999.00') AS debit_amount_1,
       NULL AS foreign_debit_amount_1,
       NULL AS currency,
       'מעמחוז' AS credit_account_1,
       to_char(float8 (ABS( SUM(real_vat)))  , 'FM999999999.00') AS credit_amount_1,
       NULL AS foreign_credit_amount_1,
       NULL AS debit_account_2,
       NULL AS debit_amount_2,
       NULL AS foreign_debit_amount_2,
       NULL AS credit_account_2,
       NULL AS credit_amount_2,
       NULL AS foreign_credit_amount_2,
       concat('פקודת מע״מ ', to_char( date_trunc('month', month_input::date)::date , 'MM/YYYY')) as details,
       NULL::integer AS reference_1,
       NULL AS reference_2,
       NULL AS movement_type,
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS value_date,
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS date_3,
       null::uuid as original_id,
       'all_vat_to_pay_for_previous_month' as origin,
       ''
    FROM
         formatted_merged_tables
    WHERE
         event_date::text::date >= (date_trunc('month', month_input::date))::date AND
         event_date::text::date <= (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date AND
         vat < 0
), all_reports as (
    SELECT * FROM two_sides
    UNION ALL
    SELECT * FROM one_side
    UNION ALL
    SELECT * FROM invoice_rates_change
    UNION ALL
    SELECT * FROM conversions
    UNION ALL
    SELECT * FROM conversions_fees
    UNION ALL
    SELECT * FROM transfer_fees
    UNION ALL
    SELECT * FROM all_vat_to_recieve_for_previous_month
    UNION ALL
    SELECT * FROM all_vat_to_pay_for_previous_month
    UNION ALL
    SELECT * FROM withholding_tax
), checking_asmachta2 as (
    SELECT
           reference_2,
           details,
           *
    FROM full_report_selection
    WHERE
        personal_category <> 'conversion' AND
        financial_entity <> 'Isracard' AND
        financial_entity <> 'Uri Goldshtein' AND
        financial_entity <> 'Poalim' AND
        reference_2 IS NULL
)
SELECT *
FROM all_reports
ORDER BY to_date(invoice_date, 'DD/MM/YYYY'), reference_1 desc, reference_2 desc, debit_amount_1 desc, debit_account_1 desc;



$$;

SELECT
  *
FROM
  accounter_schema.ledger
WHERE
  hashavshevet_id IS NULL
  AND to_date(date_3, 'DD/MM/YYYY') > to_date('30/11/2020', 'DD/MM/YYYY')
ORDER BY
  (to_date(date_3, 'DD/MM/YYYY')),
  original_id,
  invoice_date;