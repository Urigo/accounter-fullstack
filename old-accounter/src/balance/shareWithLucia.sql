SELECT
  event_date,
  event_amount,
  bank_description,
  SUM((event_amount_in_usd_with_vat_if_exists / 2) * -1) OVER (
    ORDER BY
      event_date,
      event_number,
      event_amount,
      bank_reference,
      account_number
  ) AS sum_till_this_point,
  bank_reference,
  account_number,
  event_number
FROM
  formatted_merged_tables
WHERE
  event_date :: date >= '2019-12-01' :: TIMESTAMP
  AND financial_accounts_to_balance = 'lucia'
ORDER BY
  event_date,
  event_number,
  event_amount,
  bank_reference,
  account_number;