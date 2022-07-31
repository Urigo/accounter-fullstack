SELECT
  *
FROM
  merged_tables
WHERE
  account_number = '61066'
  AND hashavshevet_id IS NULL
  AND event_date::TEXT::date >= '2019-12-31'
ORDER BY
  event_date::TEXT::date,
  event_number;

SELECT
  deal_sum,
  full_purchase_date
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  full_supplier_name_heb = 'חברת פרטנר תקשורת בע'
ORDER BY
  full_purchase_date::TEXT::date;
