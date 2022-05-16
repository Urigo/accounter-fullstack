select *
into table accounter_schema.narkis_review
from get_unified_tax_report_of_month('2020-01-01', '2020-11-01')
order by to_date(תאריך_3, 'DD/MM/YYYY'), original_id, פרטים, חשבון_חובה_1, id;

select *
from accounter_schema.narkis_review;

  select *
  from get_unified_tax_report_of_month('2020-01-01', '2020-11-01')
  order by to_date(תאריך_3, 'DD/MM/YYYY'), original_id, פרטים, חשבון_חובה_1, id;


select * from input_salary('a2da2803-26ac-4b3e-8014-7f300aaaa0f3');

drop function report_to_hashavshevet_by_month(salary_transaction uuid);
CREATE OR REPLACE FUNCTION input_salary(salary_transaction_id uuid)
RETURNS TABLE(
       תאריך_חשבונית varchar,
       חשבון_חובה_1 varchar,
       סכום_חובה_1 varchar,
       מטח_סכום_חובה_1 varchar,
       מטבע varchar,
       חשבון_זכות_1 varchar,
       סכום_זכות_1 varchar,
       מטח_סכום_זכות_1 varchar,
       חשבון_חובה_2 varchar,
       סכום_חובה_2 varchar,
       מטח_סכום_חובה_2 varchar,
       חשבון_זכות_2 varchar,
       סכום_זכות_2 varchar,
       מטח_סכום_זכות_2 varchar,
       פרטים varchar,
       אסמכתא_1 bigint,
       אסמכתא_2 varchar,
       סוג_תנועה varchar,
       תאריך_ערך varchar,
       תאריך_3 varchar,
       original_id uuid,
       origin text,
       proforma_invoice_file text,
       id uuid,
       reviewed boolean,
       hashavshevet_id int
)
LANGUAGE SQL
AS $$

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