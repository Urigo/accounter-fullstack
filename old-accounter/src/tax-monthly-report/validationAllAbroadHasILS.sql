SELECT
  *
FROM
  get_tax_report_of_month('2020-03-01')
WHERE
  (
    (
      foreign_debit_amount_1 IS NOT NULL
      AND foreign_debit_amount_1 <> ''
      AND debit_amount_1 IS NULL
    )
    OR (
      foreign_debit_amount_2 IS NOT NULL
      AND foreign_debit_amount_2 <> ''
      AND debit_amount_2 IS NULL
    )
    OR (
      foreign_credit_amount_1 IS NOT NULL
      AND foreign_credit_amount_1 <> ''
      AND credit_amount_1 IS NULL
    )
    OR (
      foreign_credit_amount_2 IS NOT NULL
      AND foreign_credit_amount_2 <> ''
      AND credit_amount_2 IS NULL
    )
  );
