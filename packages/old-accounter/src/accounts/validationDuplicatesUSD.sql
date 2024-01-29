SELECT
  executing_date,
  event_amount,
  reference_number,
  account_number,
  COUNT(*)
FROM
  accounter_schema.poalim_usd_account_transactions
GROUP BY
  executing_date,
  event_amount,
  reference_number,
  account_number
HAVING
  COUNT(*) > 1;
