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
               (date_trunc('month',executing_date::date) + interval '1 month' - interval '1 day')::date,
               'DD/MM/YYYY'
          ) as end_of_month,
          to_char(executing_date::date, 'MM/YY') as month_year_number
    from accounter_schema.poalim_usd_account_transactions
    where
          id = salary_transaction_id
)
insert into accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
("תאריך_חשבונית", "חשבון_חובה_1", "סכום_חובה_1", "מטח_סכום_חובה_1", "מטבע", "חשבון_זכות_1", "סכום_זכות_1", "מטח_סכום_זכות_1", "חשבון_חובה_2", "סכום_חובה_2", "מטח_סכום_חובה_2", "חשבון_זכות_2", "סכום_זכות_2", "מטח_סכום_זכות_2", "פרטים", "אסמכתא_1", "אסמכתא_2", "סוג_תנועה", "תאריך_ערך", "תאריך_3", original_id, origin, proforma_invoice_file, id, reviewed, hashavshevet_id) VALUES
(salary_transaction.end_of_month, null, null, null, null, 'בלני', 1167, null, null, null, null, null, null, null, ' ב.ל. חו"ז' || salary_transaction.month_year_number, null, null, null, salary_transaction.end_of_month, salary_transaction.value_date, salary_transaction_id, 'manual_salary', null, gen_random_uuid(), null, null),
(salary_transaction.end_of_month, null, null, null, null, 'מהני', 730, null, null, null, null, null, null, null, ' מ.ה. ניכוי' || salary_transaction.month_year_number, null, null, null, salary_transaction.end_of_month, salary_transaction.value_date, salary_transaction_id, 'manual_salary', null, gen_random_uuid(), null, null),
(salary_transaction.end_of_month, null, null, null, null, 'זקופות', 105, null, null, null, null, null, null, null, ' זקופות-זכות' || salary_transaction.month_year_number, null, null, null, salary_transaction.end_of_month, salary_transaction.value_date, salary_transaction_id, 'manual_salary', null, gen_random_uuid(), null, null),
(salary_transaction.end_of_month, null, null, null, null, 'אורי', 8604, null, null, null, null, null, null, null, ' גולדשטיין אורי' || salary_transaction.month_year_number, null, null, null, salary_transaction.end_of_month, salary_transaction.value_date, salary_transaction_id, 'manual_salary', null, gen_random_uuid(), null, null),
(salary_transaction.end_of_month, 'הוצז', 105, null, null, null, null, null, null, null, null, null, null, null, ' זקופות-חובה' || salary_transaction.month_year_number, null, null, null, salary_transaction.end_of_month, salary_transaction.value_date, salary_transaction_id, 'manual_salary', null, gen_random_uuid(), null, null),
(salary_transaction.end_of_month, 'שכע', 10000, null, null, null, null, null, null, null, null, null, null, null, ' הוצ. משכורת' || salary_transaction.month_year_number, null, null, null, salary_transaction.end_of_month, salary_transaction.value_date, salary_transaction_id, 'manual_salary', null, gen_random_uuid(), null, null),
(salary_transaction.end_of_month, 'סוצ', 501, null, null, null, null, null, null, null, null, null, null, null, ' הוצ. ב.ל' || salary_transaction.month_year_number, null, null, null, salary_transaction.end_of_month, salary_transaction.value_date, salary_transaction_id, 'manual_salary', null, gen_random_uuid(), null, null)
returning *;

$$;