SELECT
  event_date,
  event_amount,
  reference_number,
  account_number,
  count(*)
FROM
  accounter_schema.poalim_ils_account_transactions
GROUP BY
  event_date,
  event_amount,
  reference_number,
  account_number
HAVING
  count(*) > 1;