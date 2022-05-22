SELECT
  *
FROM
  accounter_schema.ledger
WHERE
  hashavshevet_id IS NULL
  AND to_date(תאריך_3, 'DD/MM/YYYY') >= to_date('30/04/2021', 'DD/MM/YYYY')
  AND business = 'a1f66c23-cea3-48a8-9a4b-0b4a0422851a'
ORDER BY
  (to_date(תאריך_3, 'DD/MM/YYYY')),
  original_id,
  תאריך_חשבונית;

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
  AND to_date(hashavshevet.תאריך_חשבונית, 'DD/MM/YYYY') >= date_trunc('month', '2020-07-01' :: date);

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
    AND to_date(hashavshevet.תאריך_חשבונית, 'DD/MM/YYYY') >= date_trunc('month', '2020-09-01' :: date)
    AND to_date(hashavshevet.תאריך_חשבונית, 'DD/MM/YYYY') <= (
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
  to_date(תאריך_3, 'DD/MM/YYYY'),
  original_id,
  פרטים,
  חשבון_חובה_1;

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
  AND to_date(תאריך_3, 'DD/MM/YYYY') >= to_date('01/10/2020', 'DD/MM/YYYY')
ORDER BY
  (to_date(תאריך_3, 'DD/MM/YYYY'));

DROP FUNCTION report_to_hashavshevet_by_month(month_report VARCHAR);

CREATE
OR REPLACE FUNCTION report_to_hashavshevet_by_month(month_report VARCHAR) RETURNS TABLE(
  תאריך_חשבונית VARCHAR,
  חשבון_חובה_1 VARCHAR,
  סכום_חובה_1 VARCHAR,
  מטח_סכום_חובה_1 VARCHAR,
  מטבע VARCHAR,
  חשבון_זכות_1 VARCHAR,
  סכום_זכות_1 VARCHAR,
  מטח_סכום_זכות_1 VARCHAR,
  חשבון_חובה_2 VARCHAR,
  סכום_חובה_2 VARCHAR,
  מטח_סכום_חובה_2 VARCHAR,
  חשבון_זכות_2 VARCHAR,
  סכום_זכות_2 VARCHAR,
  מטח_סכום_זכות_2 VARCHAR,
  פרטים VARCHAR,
  אסמכתא_1 BIGINT,
  אסמכתא_2 VARCHAR,
  סוג_תנועה VARCHAR,
  תאריך_ערך VARCHAR,
  תאריך_3 VARCHAR,
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
     to_date(hashavshevet.תאריך_חשבונית, 'DD/MM/YYYY') >= date_trunc('month', month_report::date) and
     to_date(hashavshevet.תאריך_חשבונית, 'DD/MM/YYYY') <= (date_trunc('month', month_report::date) + interval '1 month' - interval '1 day')::date
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
order by to_date(תאריך_3, 'DD/MM/YYYY'), original_id, פרטים, חשבון_חובה_1;

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
  to_date(תאריך_3, 'DD/MM/YYYY') DESC,
  original_id,
  פרטים,
  חשבון_חובה_1,
  id;

DROP FUNCTION get_unified_tax_report_of_month;

CREATE
OR REPLACE FUNCTION get_unified_tax_report_of_month(
  business_name TEXT,
  month_start VARCHAR,
  month_end VARCHAR
) RETURNS TABLE(
  תאריך_חשבונית VARCHAR,
  חשבון_חובה_1 VARCHAR,
  סכום_חובה_1 VARCHAR,
  מטח_סכום_חובה_1 VARCHAR,
  מטבע VARCHAR,
  חשבון_זכות_1 VARCHAR,
  סכום_זכות_1 VARCHAR,
  מטח_סכום_זכות_1 VARCHAR,
  חשבון_חובה_2 VARCHAR,
  סכום_חובה_2 VARCHAR,
  מטח_סכום_חובה_2 VARCHAR,
  חשבון_זכות_2 VARCHAR,
  סכום_זכות_2 VARCHAR,
  מטח_סכום_זכות_2 VARCHAR,
  פרטים VARCHAR,
  אסמכתא_1 BIGINT,
  אסמכתא_2 VARCHAR,
  סוג_תנועה VARCHAR,
  תאריך_ערך VARCHAR,
  תאריך_3 VARCHAR,
  original_id uuid,
  origin TEXT,
  proforma_invoice_file TEXT,
  id uuid,
  reviewed BOOLEAN,
  hashavshevet_id INT
) LANGUAGE SQL AS $$


(
select hashavshevet.תאריך_חשבונית,
       hashavshevet.חשבון_חובה_1,
       hashavshevet.סכום_חובה_1,
       hashavshevet.מטח_סכום_חובה_1,
       hashavshevet.מטבע,
       hashavshevet.חשבון_זכות_1,
       hashavshevet.סכום_זכות_1,
       hashavshevet.מטח_סכום_זכות_1,
       hashavshevet.חשבון_חובה_2,
       hashavshevet.סכום_חובה_2,
       hashavshevet.מטח_סכום_חובה_2,
       hashavshevet.חשבון_זכות_2,
       hashavshevet.סכום_זכות_2,
       hashavshevet.מטח_סכום_זכות_2,
       hashavshevet.פרטים,
       hashavshevet.אסמכתא_1,
       hashavshevet.אסמכתא_2,
       hashavshevet.סוג_תנועה,
       hashavshevet.תאריך_ערך,
       hashavshevet.תאריך_3,
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
       formatted_event_date as תאריך_חשבונית,
       formatted_account as חשבון_חובה_1,
       concat(event_amount::text, ' ', currency_code) as סכום_חובה_1,
       bank_description as מטח_סכום_חובה_1,
       '' as מטבע,
       formatted_financial_entity as חשבון_זכות_1,
       tax_category as סכום_זכות_1,
       to_char(current_balance, 'FM999999999.00') as מטח_סכום_זכות_1,
       '' as חשבון_חובה_2,
       '' as סכום_חובה_2,
       '' as מטח_סכום_חובה_2,
       '' as חשבון_זכות_2,
       '' as סכום_זכות_2,
       id::text as מטח_סכום_זכות_2,
       '0' as פרטים,
       bank_reference as אסמכתא_1,
       to_char(tax_invoice_date, 'DD/MM/YYYY') as אסמכתא_2,
       vat::text as סוג_תנועה,
       to_char(debit_date, 'DD/MM/YYYY') as תאריך_ערך,
       formatted_event_date as תאריך_3,
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
      COALESCE(t1.תאריך_חשבונית, '') = COALESCE(t2.תאריך_חשבונית, '')
      AND COALESCE(t1.חשבון_חובה_1, '') = COALESCE(t2.חשבון_חובה_1, '')
      AND COALESCE(t1.סכום_חובה_1, '') = COALESCE(t2.סכום_חובה_1, '')
      AND COALESCE(t1.מטח_סכום_חובה_1, '') = COALESCE(t2.מטח_סכום_חובה_1, '')
      AND COALESCE(t1.מטבע, '') = COALESCE(t2.מטבע, '')
      AND COALESCE(t1.חשבון_זכות_1, '') = COALESCE(t2.חשבון_זכות_1, '')
      AND COALESCE(t1.סכום_זכות_1, '') = COALESCE(t2.סכום_זכות_1, '')
      AND COALESCE(t1.מטח_סכום_זכות_1, '') = COALESCE(t2.מטח_סכום_זכות_1, '')
      AND COALESCE(t1.חשבון_חובה_2, '') = COALESCE(t2.חשבון_חובה_2, '')
      AND COALESCE(t1.סכום_חובה_2, '') = COALESCE(t2.סכום_חובה_2, '')
      AND COALESCE(t1.מטח_סכום_חובה_2, '') = COALESCE(t2.מטח_סכום_חובה_2, '')
      AND COALESCE(t1.חשבון_זכות_2, '') = COALESCE(t2.חשבון_זכות_2, '')
      AND COALESCE(t1.סכום_זכות_2, '') = COALESCE(t2.סכום_זכות_2, '')
      AND COALESCE(t1.מטח_סכום_זכות_2, '') = COALESCE(t2.מטח_סכום_זכות_2, '')
      AND COALESCE(t1.פרטים, '') = COALESCE(t2.פרטים, '')
      AND COALESCE(t1.אסמכתא_1, 0) = COALESCE(t2.אסמכתא_1, 0)
      AND COALESCE(t1.אסמכתא_2, '') = COALESCE(t2.אסמכתא_2, '')
      AND COALESCE(t1.סוג_תנועה, '') = COALESCE(t2.סוג_תנועה, '')
      AND COALESCE(t1.תאריך_ערך, '') = COALESCE(t2.תאריך_ערך, '')
      AND COALESCE(t1.תאריך_3, '') = COALESCE(t2.תאריך_3, '')
  ) AS reviewed,
  (
    SELECT
      t1.hashavshevet_id
    FROM
      accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08 t1
    WHERE
      COALESCE(t1.תאריך_חשבונית, '') = COALESCE(t2.תאריך_חשבונית, '')
      AND COALESCE(t1.חשבון_חובה_1, '') = COALESCE(t2.חשבון_חובה_1, '')
      AND COALESCE(t1.סכום_חובה_1, '') = COALESCE(t2.סכום_חובה_1, '')
      AND COALESCE(t1.מטח_סכום_חובה_1, '') = COALESCE(t2.מטח_סכום_חובה_1, '')
      AND COALESCE(t1.מטבע, '') = COALESCE(t2.מטבע, '')
      AND COALESCE(t1.חשבון_זכות_1, '') = COALESCE(t2.חשבון_זכות_1, '')
      AND COALESCE(t1.סכום_זכות_1, '') = COALESCE(t2.סכום_זכות_1, '')
      AND COALESCE(t1.מטח_סכום_זכות_1, '') = COALESCE(t2.מטח_סכום_זכות_1, '')
      AND COALESCE(t1.חשבון_חובה_2, '') = COALESCE(t2.חשבון_חובה_2, '')
      AND COALESCE(t1.סכום_חובה_2, '') = COALESCE(t2.סכום_חובה_2, '')
      AND COALESCE(t1.מטח_סכום_חובה_2, '') = COALESCE(t2.מטח_סכום_חובה_2, '')
      AND COALESCE(t1.חשבון_זכות_2, '') = COALESCE(t2.חשבון_זכות_2, '')
      AND COALESCE(t1.סכום_זכות_2, '') = COALESCE(t2.סכום_זכות_2, '')
      AND COALESCE(t1.מטח_סכום_זכות_2, '') = COALESCE(t2.מטח_סכום_זכות_2, '')
      AND COALESCE(t1.פרטים, '') = COALESCE(t2.פרטים, '')
      AND COALESCE(t1.אסמכתא_1, 0) = COALESCE(t2.אסמכתא_1, 0)
      AND COALESCE(t1.אסמכתא_2, '') = COALESCE(t2.אסמכתא_2, '')
      AND COALESCE(t1.סוג_תנועה, '') = COALESCE(t2.סוג_תנועה, '')
      AND COALESCE(t1.תאריך_ערך, '') = COALESCE(t2.תאריך_ערך, '')
      AND COALESCE(t1.תאריך_3, '') = COALESCE(t2.תאריך_3, '')
  ) AS hashavshevet_id INTO TABLE accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
FROM
  (
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-03-01')
      ORDER BY
        to_date(תאריך_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-04-01')
      ORDER BY
        to_date(תאריך_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-05-01')
      ORDER BY
        to_date(תאריך_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-06-01')
      ORDER BY
        to_date(תאריך_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-07-01')
      ORDER BY
        to_date(תאריך_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-08-01')
      ORDER BY
        to_date(תאריך_3, 'DD/MM/YYYY'),
        original_id
    )
    UNION ALL
    (
      SELECT
        *
      FROM
        get_tax_report_of_month('2020-09-01')
      ORDER BY
        to_date(תאריך_3, 'DD/MM/YYYY'),
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
        תאריך_חשבונית,
        חשבון_חובה_1,
        סכום_חובה_1,
        מטח_סכום_חובה_1,
        מטבע,
        חשבון_זכות_1,
        סכום_זכות_1,
        מטח_סכום_זכות_1,
        חשבון_חובה_2,
        סכום_חובה_2,
        מטח_סכום_חובה_2,
        חשבון_זכות_2,
        סכום_זכות_2,
        מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        אסמכתא_2,
        סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
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
  to_date(תאריך_3, 'DD/MM/YYYY'),
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
    תאריך_חשבונית,
    חשבון_חובה_1,
    סכום_חובה_1,
    מטח_סכום_חובה_1,
    מטבע,
    חשבון_זכות_1,
    סכום_זכות_1,
    מטח_סכום_זכות_1,
    חשבון_חובה_2,
    סכום_חובה_2,
    מטח_סכום_חובה_2,
    חשבון_זכות_2,
    סכום_זכות_2,
    מטח_סכום_זכות_2,
    פרטים,
    אסמכתא_1,
    אסמכתא_2,
    סוג_תנועה,
    תאריך_ערך,
    תאריך_3,
    original_id,
    origin,
    proforma_invoice_file,
    id
  )
SELECT
  *,
  gen_random_uuid() -- into table accounter_schema.saved_tax_reports_2020_03_04
FROM
  get_tax_report_of_month('2020-12-01') -- order by to_date(תאריך_3, 'DD/MM/YYYY'), original_id
;

SELECT
  *
FROM
  get_tax_report_of_month('2020-12-01');

DROP FUNCTION get_tax_report_of_month(month_input VARCHAR);

CREATE
OR REPLACE FUNCTION get_tax_report_of_month(month_input VARCHAR) RETURNS TABLE(
  תאריך_חשבונית VARCHAR,
  חשבון_חובה_1 VARCHAR,
  סכום_חובה_1 VARCHAR,
  מטח_סכום_חובה_1 VARCHAR,
  מטבע VARCHAR,
  חשבון_זכות_1 VARCHAR,
  סכום_זכות_1 VARCHAR,
  מטח_סכום_זכות_1 VARCHAR,
  חשבון_חובה_2 VARCHAR,
  סכום_חובה_2 VARCHAR,
  מטח_סכום_חובה_2 VARCHAR,
  חשבון_זכות_2 VARCHAR,
  סכום_זכות_2 VARCHAR,
  מטח_סכום_זכות_2 VARCHAR,
  פרטים VARCHAR,
  אסמכתא_1 BIGINT,
  אסמכתא_2 VARCHAR,
  סוג_תנועה VARCHAR,
  תאריך_ערך VARCHAR,
  תאריך_3 VARCHAR,
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
        END) AS תאריך_חשבונית,
        (CASE WHEN event_amount < 0 THEN
            (CASE WHEN side = 0 THEN
                formatted_tax_category
                ELSE formatted_financial_entity
            END) ELSE
            (CASE WHEN side = 0 THEN
                formatted_financial_entity
                ELSE formatted_account
            END)
        END) AS חשבון_חובה_1,
        (CASE WHEN event_amount < 0 THEN
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_if_exists
                ELSE formatted_event_amount_in_ils_with_interest
            END) ELSE
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_with_vat_if_exists
                ELSE formatted_event_amount_in_ils
            END)
        END) AS סכום_חובה_1,
        (CASE
            WHEN side = 0 THEN formatted_invoice_foreign_amount_if_exist
            ELSE formatted_foreign_amount_if_exist
        END) AS מטח_סכום_חובה_1,
        formatted_currency AS מטבע,
        (CASE WHEN event_amount < 0 THEN
           (CASE
              WHEN side = 0 THEN formatted_financial_entity
              ELSE formatted_account
           END) ELSE
           (CASE
               WHEN side = 0 THEN formatted_tax_category
               ELSE formatted_financial_entity
           END)
        END) AS חשבון_זכות_1,
        (CASE WHEN event_amount > 0 THEN
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_if_exists
                ELSE formatted_event_amount_in_ils_with_interest
            END) ELSE
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_with_vat_if_exists
                ELSE formatted_event_amount_in_ils
            END)
        END) AS סכום_זכות_1,
        (CASE
            WHEN side = 0 THEN formatted_invoice_foreign_amount_if_exist
            ELSE formatted_foreign_amount_if_exist
        END) AS מטח_סכום_זכות_1,
        (CASE
            WHEN (side = 0 AND event_amount < 0 AND vat <> 0) THEN 'תשו'
            when (side = 1 and event_amount < 0 and interest <> 0) THEN 'הכנרבמ'
--             ELSE NULL
            END
        ) AS חשבון_חובה_2,
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
        end) AS סכום_חובה_2,
        (case when (side = 0 and event_amount < 0) then to_char(float8 (abs(formatted_foreign_vat)), 'FM999999999.00')
        end) AS מטח_סכום_חובה_2,
        (CASE
            WHEN (side = 0 AND event_amount > 0 AND vat <> 0) THEN 'עסק'
            when (side = 1 and event_amount > 0 and interest <> 0) THEN 'הכנרבמ'
--             ELSE NULL
            END
        ) AS חשבון_זכות_2,
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
        end) AS סכום_זכות_2,
        (case when (side = 0 and event_amount > 0) then to_char(float8 (abs(formatted_foreign_vat)), 'FM999999999.00')
        end) AS מטח_סכום_זכות_2,
        user_description AS פרטים,
        bank_reference AS אסמכתא_1,
        RIGHT(regexp_replace(tax_invoice_number, '[^0-9]+', '', 'g'), 9) AS אסמכתא_2,
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
        ) AS סוג_תנועה,
       (case
           when (tax_invoice_date is not null and account_type != 'creditcard' and side = 0) then formatted_tax_invoice_date
           else (CASE
                    WHEN debit_date IS NULL THEN formatted_event_date
                    ELSE formatted_debit_date
                END)
       end) as תאריך_ערך,
        formatted_event_date AS תאריך_3,
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
        תאריך_חשבונית,
        חשבון_חובה_1,
        סכום_חובה_1,
        מטח_סכום_חובה_1,
        מטבע,
        חשבון_זכות_1,
        סכום_זכות_1,
        מטח_סכום_זכות_1,
        חשבון_חובה_2,
        סכום_חובה_2,
        מטח_סכום_חובה_2,
        חשבון_זכות_2,
        סכום_זכות_2,
        מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        אסמכתא_2,
        סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
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
        תאריך_חשבונית,
        חשבון_חובה_1,
        סכום_חובה_1,
        מטח_סכום_חובה_1,
        מטבע,
        חשבון_זכות_1,
        סכום_זכות_1,
        מטח_סכום_זכות_1,
        חשבון_חובה_2,
        סכום_חובה_2,
        מטח_סכום_חובה_2,
        חשבון_זכות_2,
        סכום_זכות_2,
        מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        אסמכתא_2,
        סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
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
        תאריך_חשבונית,
        (CASE WHEN event_amount > 0 THEN חשבון_חובה_1 END) as חשבון_חובה_1,
        (CASE WHEN event_amount > 0 THEN סכום_חובה_1 END) as סכום_חובה_1,
        (CASE WHEN event_amount > 0 THEN מטח_סכום_חובה_1 END) as מטח_סכום_חובה_1,
        מטבע,
        (CASE WHEN event_amount < 0 THEN חשבון_זכות_1 END) as חשבון_זכות_1,
        (CASE WHEN event_amount < 0 THEN סכום_זכות_1 END) as סכום_זכות_1,
        (CASE WHEN event_amount < 0 THEN מטח_סכום_זכות_1 END) as מטח_זכות_חובה_1,
        '' AS חשבון_חובה_2,
        '' AS סכום_חובה_2,
        '' AS מטח_סכום_חובה_2,
        '' AS חשבון_זכות_2,
        '' AS סכום_זכות_2,
        '' AS מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        '' AS אסמכתא_2,
        '' AS סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
        id as original_id,
        'conversions' as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
         is_conversion IS TRUE AND
         side = 1
), conversions_fees as (
    SELECT
        תאריך_חשבונית,
        'שער' as חשבון_חובה_1,
        to_char(float8 (CASE WHEN event_amount > 0 THEN
            ((
                select סכום_זכות_1
                from full_report_selection t1
                where
                    t1.is_conversion is true and
                    side = 1 and
                    אסמכתא_1 = t1.אסמכתא_1 and
                    t1.event_amount < 0
            )::float - סכום_חובה_1::float)
        END), 'FM999999999.00') as סכום_חובה_1,
        '' as מטח_סכום_חובה_1,
        '' as מטבע,
        '' as חשבון_זכות_1,
        '' as סכום_זכות_1,
        '' as מטח_זכות_חובה_1,
        '' AS חשבון_חובה_2,
        '' AS סכום_חובה_2,
        '' AS מטח_סכום_חובה_2,
        '' AS חשבון_זכות_2,
        '' AS סכום_זכות_2,
        '' AS מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        '' AS אסמכתא_2,
        '' AS סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
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
            תאריך_חשבונית AS תאריך_חשבונית,
            'שער' AS חשבון_חובה_1,
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
                , 'FM999999999.00') as סכום_חובה_1,
            '' AS מטח_סכום_חובה_1,
            '' AS מטבע,
            (case
                when financial_entity = 'Poalim' then ''
                else formatted_financial_entity
            end) AS חשבון_זכות_1,
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
            end) as סכום_זכות_1,
            '' AS מטח_סכום_זכות_1,
            '' AS חשבון_חובה_2,
            '' AS סכום_חובה_2,
            '' AS מטח_סכום_חובה_2,
            '' AS חשבון_זכות_2,
            '' AS סכום_זכות_2,
            '' AS מטח_סכום_זכות_2,
            פרטים AS פרטים,
            אסמכתא_1 AS אסמכתא_1,
            אסמכתא_2 AS אסמכתא_2,
            '' AS סוג_תנועה,
           תאריך_ערך AS תאריך_ערך,
           תאריך_3 AS תאריך_3,
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
            formatted_event_date AS תאריך_חשבונית,
            'עמל' AS חשבון_חובה_1,
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
            END), 'FM999999999.00') AS סכום_חובה_1,
            to_char(float8 (ABS(tax_invoice_amount) - event_amount), 'FM999999999.00') AS מטח_סכום_חובה_1,
            formatted_currency AS מטבע,
            financial_entity AS חשבון_זכות_1,
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
            END), 'FM999999999.00') AS סכום_זכות_1,
            to_char(float8 (ABS(tax_invoice_amount) - event_amount), 'FM999999999.00') AS מטח_סכום_זכות_1,
            '' AS חשבון_חובה_2,
            '' AS סכום_חובה_2,
            '' AS מטח_סכום_חובה_2,
            '' AS חשבון_זכות_2,
            '' AS סכום_זכות_2,
            '' AS מטח_סכום_זכות_2,
            user_description AS פרטים,
            bank_reference AS אסמכתא_1,
            '' AS אסמכתא_2,
            '' AS סוג_תנועה,
           formatted_debit_date AS תאריך_ערך,
           formatted_event_date AS תאריך_3,
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
            formatted_event_date AS תאריך_חשבונית,
            'ניבמלק' AS חשבון_חובה_1,
            to_char(float8 (ABS(tax_invoice_amount + COALESCE(vat, 0)) - event_amount), 'FM999999999.00') AS סכום_חובה_1,
            null,
            formatted_currency AS מטבע,
            financial_entity AS חשבון_זכות_1,
            to_char(float8 (ABS(tax_invoice_amount + COALESCE(vat, 0)) - event_amount), 'FM999999999.00') AS סכום_זכות_1,
            null AS מטח_סכום_זכות_1,
            '' AS חשבון_חובה_2,
            '' AS סכום_חובה_2,
            '' AS מטח_סכום_חובה_2,
            '' AS חשבון_זכות_2,
            '' AS סכום_זכות_2,
            '' AS מטח_סכום_זכות_2,
            user_description AS פרטים,
            bank_reference AS אסמכתא_1,
            tax_invoice_number AS אסמכתא_2,
            '' AS סוג_תנועה,
           formatted_debit_date AS תאריך_ערך,
           formatted_event_date AS תאריך_3,
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
       , 'DD/MM/YYYY') AS תאריך_חשבונית,
       'מעמחוז' AS חשבון_חובה_1,
       to_char(float8 (ABS( SUM(real_vat)))  , 'FM999999999.00') AS סכום_חובה_1,
       NULL AS מטח_סכום_חובה_1,
       NULL AS מטבע,
       'תשו' AS חשבון_זכות_1,
       to_char(float8 (ABS( SUM(real_vat)))  , 'FM999999999.00') AS סכום_זכות_1,
       NULL AS מטח_סכום_זכות_1,
       NULL AS חשבון_חובה_2,
       NULL AS סכום_חובה_2,
       NULL AS מטח_סכום_חובה_2,
       NULL AS חשבון_זכות_2,
       NULL AS סכום_זכות_2,
       NULL AS מטח_סכום_זכות_2,
       concat('פקודת מע״מ ', to_char( date_trunc('month', month_input::date)::date , 'MM/YYYY')) as פרטים,
       NULL::integer AS אסמכתא_1,
       NULL AS אסמכתא_2,
       NULL AS סוג_תנועה,
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS תאריך_ערך,
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS תאריך_3,
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
       , 'DD/MM/YYYY') AS תאריך_חשבונית,
       'עסק' AS חשבון_חובה_1,
       to_char(float8 (ABS( SUM(real_vat)))  , 'FM999999999.00') AS סכום_חובה_1,
       NULL AS מטח_סכום_חובה_1,
       NULL AS מטבע,
       'מעמחוז' AS חשבון_זכות_1,
       to_char(float8 (ABS( SUM(real_vat)))  , 'FM999999999.00') AS סכום_זכות_1,
       NULL AS מטח_סכום_זכות_1,
       NULL AS חשבון_חובה_2,
       NULL AS סכום_חובה_2,
       NULL AS מטח_סכום_חובה_2,
       NULL AS חשבון_זכות_2,
       NULL AS סכום_זכות_2,
       NULL AS מטח_סכום_זכות_2,
       concat('פקודת מע״מ ', to_char( date_trunc('month', month_input::date)::date , 'MM/YYYY')) as פרטים,
       NULL::integer AS אסמכתא_1,
       NULL AS אסמכתא_2,
       NULL AS סוג_תנועה,
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS תאריך_ערך,
       to_char(
           (date_trunc('month', month_input::date) + interval '1 month' - interval '1 day')::date
       , 'DD/MM/YYYY') AS תאריך_3,
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
           אסמכתא_2,
           פרטים,
           *
    FROM full_report_selection
    WHERE
        personal_category <> 'conversion' AND
        financial_entity <> 'Isracard' AND
        financial_entity <> 'Uri Goldshtein' AND
        financial_entity <> 'Poalim' AND
        אסמכתא_2 IS NULL
)
SELECT *
FROM all_reports
ORDER BY to_date(תאריך_חשבונית, 'DD/MM/YYYY'), אסמכתא_1 desc, אסמכתא_2 desc, סכום_חובה_1 desc, חשבון_חובה_1 desc;



$$;

SELECT
  *
FROM
  accounter_schema.ledger
WHERE
  hashavshevet_id IS NULL
  AND to_date(תאריך_3, 'DD/MM/YYYY') > to_date('30/11/2020', 'DD/MM/YYYY')
ORDER BY
  (to_date(תאריך_3, 'DD/MM/YYYY')),
  original_id,
  תאריך_חשבונית;