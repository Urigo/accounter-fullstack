SELECT
  * INTO TABLE accounter_schema.narkis_review
FROM
  get_unified_tax_report_of_month('2020-01-01', '2020-11-01')
ORDER BY
  to_date(date_3, 'DD/MM/YYYY'),
  original_id,
  details,
  debit_account_1,
  id;

SELECT
  *
FROM
  accounter_schema.narkis_review;

SELECT
  *
FROM
  get_unified_tax_report_of_month('2020-01-01', '2020-11-01')
ORDER BY
  to_date(date_3, 'DD/MM/YYYY'),
  original_id,
  details,
  debit_account_1,
  id;

SELECT
  *
FROM
  input_salary('a2da2803-26ac-4b3e-8014-7f300aaaa0f3');

DROP FUNCTION report_to_hashavshevet_by_month(salary_transaction uuid);

CREATE
OR REPLACE FUNCTION input_salary(salary_transaction_id uuid) RETURNS TABLE(
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

with salary_transaction as (
    select *,
           to_char(
               (date_trunc('month',event_date::date) + interval '1 month' - interval '1 day')::date,
               'DD/MM/YYYY'
          ) as end_of_month,
          to_char(event_date::date, 'MM/YY') as month_year_number
--     from accounter_schema.poalim_usd_account_transactions
    from accounter_schema.all_transactions
    where
          id = salary_transaction_id
)
insert into accounter_schema.ledger
    select end_of_month, null, null::integer, null, null, 'בלני', 1167, null, null, null, null, null, null, null, salary_transaction.month_year_number || ' ב.ל. חו"ז', null::bigint, null, null, salary_transaction.end_of_month, to_char(salary_transaction.tax_invoice_date, 'DD/MM/YYYY'), salary_transaction_id, 'manual_salary', null from salary_transaction
    union all
    select end_of_month, null, null::integer, null, null, 'מהני', 731, null, null, null, null, null, null, null, salary_transaction.month_year_number || ' מ.ה. ניכוי', null::bigint, null, null, salary_transaction.end_of_month, to_char(salary_transaction.tax_invoice_date, 'DD/MM/YYYY'), salary_transaction_id, 'manual_salary', null from salary_transaction
    union all
    select end_of_month, null, null::integer, null, null, 'זקופות', 105, null, null, null, null, null, null, null, salary_transaction.month_year_number || ' זקופות-זכות', null::bigint, null, null, salary_transaction.end_of_month, to_char(salary_transaction.tax_invoice_date, 'DD/MM/YYYY'), salary_transaction_id, 'manual_salary', null from salary_transaction
    union all
    select end_of_month, null, null::integer, null, null, 'אורי', 8603, null, null, null, null, null, null, null, salary_transaction.month_year_number || ' גולדשטיין אורי', null::bigint, null, null, salary_transaction.end_of_month, to_char(salary_transaction.tax_invoice_date, 'DD/MM/YYYY'), salary_transaction_id, 'manual_salary', null from salary_transaction
    union all
    select end_of_month, 'הוצז', 105, null, null, null, null, null, null, null, null, null, null, null, salary_transaction.month_year_number || ' זקופות-חובה', null::bigint, null, null, salary_transaction.end_of_month, to_char(salary_transaction.tax_invoice_date, 'DD/MM/YYYY'), salary_transaction_id, 'manual_salary', null from salary_transaction
    union all
    select end_of_month, 'שכע', 10000, null, null, null, null, null, null, null, null, null, null, null, salary_transaction.month_year_number || ' הוצ. משכורת', null::bigint, null, null, salary_transaction.end_of_month, to_char(salary_transaction.tax_invoice_date, 'DD/MM/YYYY'), salary_transaction_id, 'manual_salary', null from salary_transaction
    union all
    select end_of_month, 'סוצ', 501, null, null, null, null, null, null, null, null, null, null, null, salary_transaction.month_year_number || ' הוצ. ב.ל' , null::bigint, null, null, salary_transaction.end_of_month, to_char(salary_transaction.tax_invoice_date, 'DD/MM/YYYY'), salary_transaction_id, 'manual_salary', null from salary_transaction
returning *;

$$;