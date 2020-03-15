/*
 make sure that other then monthly balance and CASH ADVANCE all transactions
 has full_purchase_date or full_purchase_date_outbound
 (result should be empty)
 */
SELECT *
FROM accounter.accounter_schema.isracard_creditcard_transactions
WHERE full_supplier_name_outbound != 'TOTAL FOR DATE'
  AND full_supplier_name_outbound != 'CASH ADVANCE FEE'
  AND full_purchase_date IS NULL
  AND full_purchase_date_outbound IS NULL;

/*
 make sure that other then monthly balance and CASH ADVANCE all transactions
 has payment_sum or payment_sum_outbound
 (result should be empty)
 */
SELECT *
FROM accounter.accounter_schema.isracard_creditcard_transactions
WHERE full_supplier_name_outbound != 'TOTAL FOR DATE'
  AND full_supplier_name_outbound != 'CASH ADVANCE FEE'
  AND payment_sum IS NULL
  AND payment_sum_outbound IS NULL;

/*
 make sure that other then monthly balance and CASH ADVANCE all transactions
 has voucher_number
 (result should be empty)
 */
SELECT *
FROM accounter.accounter_schema.isracard_creditcard_transactions
WHERE full_supplier_name_outbound != 'TOTAL FOR DATE'
  AND full_supplier_name_outbound != 'CASH ADVANCE FEE'
  AND voucher_number IS NULL;

/*
 make sure that there are no duplicates in creditcards
 */
with all_creditcard_transactions as (
    SELECT *,
           CASE
               WHEN full_purchase_date IS NULL THEN full_purchase_date_outbound
               WHEN full_purchase_date_outbound IS NULL THEN full_purchase_date
               END as real_date,
           CASE
               WHEN payment_sum IS NULL THEN payment_sum_outbound
               WHEN payment_sum_outbound IS NULL THEN payment_sum
               END as real_payment
    FROM accounter.accounter_schema.isracard_creditcard_transactions
    WHERE full_supplier_name_outbound <> 'TOTAL FOR DATE'
       OR full_supplier_name_outbound IS NULL
        AND
          full_supplier_name_outbound <> 'CASH ADVANCE FEE'
       OR full_supplier_name_outbound IS NULL
)
select real_payment, real_date, voucher_number, count(*)
from all_creditcard_transactions
group by real_payment, real_date, voucher_number
HAVING count(*) > 1;
