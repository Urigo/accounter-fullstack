select *
from merged_tables
where account_number = '61066'
    and hashavshevet_id IS NULL
    and event_date::text::date >= '2019-12-31'
order by event_date::text::date, event_number;


select deal_sum, full_purchase_date
from accounter_schema.isracard_creditcard_transactions
where full_supplier_name_heb = 'חברת פרטנר תקשורת בע'
order by full_purchase_date::text::date;
