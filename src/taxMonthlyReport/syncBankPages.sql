select *
from merged_tables
where account_number = '61066'
  and event_date::text::date >= '2020-05-04'
order by event_date::text::date, event_number;
