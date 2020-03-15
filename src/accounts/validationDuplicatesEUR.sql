select executing_date,
       event_amount,
       reference_number,
       account_number,
       count(*)
from accounter_schema.poalim_eur_account_transactions
group by executing_date,
         event_amount,
         reference_number,
         account_number
HAVING count(*) > 1;