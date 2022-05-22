SELECT
  SUM(
    (
      CASE
        WHEN credit_amount_2 = '' THEN '0'
        ELSE credit_amount_2
      END
    ) :: NUMERIC
  ),
  SUM(
    (
      CASE
        WHEN debit_amount_2 = '' THEN '0'
        ELSE debit_amount_2
      END
    ) :: NUMERIC
  )
FROM
  get_tax_report_of_month('2020-03-01');