select event_date,
       event_amount,
       reference_number,
       account_number,
       count(*)
from accounter_schema.poalim_ils_account_transactions
group by event_date,
         event_amount,
         reference_number,
         account_number
HAVING count(*) > 1;