/*
 make sure that other then monthly balance and CASH ADVANCE all transactions
 has full_purchase_date or full_purchase_date_outbound
 (result should be empty)
 */
SELECT
  *
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  full_supplier_name_outbound != 'TOTAL FOR DATE'
  AND full_supplier_name_outbound != 'CASH ADVANCE FEE'
  AND full_purchase_date IS NULL
  AND full_purchase_date_outbound IS NULL;

/*
 make sure that other then monthly balance and CASH ADVANCE all transactions
 has payment_sum or payment_sum_outbound
 (result should be empty)
 */
SELECT
  *
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  full_supplier_name_outbound != 'TOTAL FOR DATE'
  AND full_supplier_name_outbound != 'CASH ADVANCE FEE'
  AND payment_sum IS NULL
  AND payment_sum_outbound IS NULL;

/*
 make sure that other then monthly balance and CASH ADVANCE all transactions
 has voucher_number
 (result should be empty)
 */
SELECT
  *
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  full_supplier_name_outbound != 'TOTAL FOR DATE'
  AND full_supplier_name_outbound != 'CASH ADVANCE FEE'
  AND voucher_number IS NULL;

/*
 make sure that there are no duplicates in creditcards
 */
WITH
  all_creditcard_transactions AS (
    SELECT
      *,
      CASE
        WHEN full_purchase_date IS NULL THEN full_purchase_date_outbound
        WHEN full_purchase_date_outbound IS NULL THEN full_purchase_date
      END AS real_date,
      CASE
        WHEN payment_sum IS NULL THEN payment_sum_outbound
        WHEN payment_sum_outbound IS NULL THEN payment_sum
      END AS real_payment
    FROM
      accounter_schema.isracard_creditcard_transactions
    WHERE
      full_supplier_name_outbound <> 'TOTAL FOR DATE'
      OR full_supplier_name_outbound IS NULL
      AND full_supplier_name_outbound <> 'CASH ADVANCE FEE'
      OR full_supplier_name_outbound IS NULL
  )
SELECT
  real_payment,
  real_date,
  voucher_number,
  count(*)
FROM
  all_creditcard_transactions
GROUP BY
  real_payment,
  real_date,
  voucher_number
HAVING
  count(*) > 1;

-- 1241
DELETE FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  card = 2733
  AND card_index = 1
  AND user_description IS NULL
  AND financial_entity IS NULL
  AND business_trip IS NULL
  AND personal_category IS NULL
  AND tax_category IS NULL
  AND even_with_dotan IS NULL
  AND proforma_invoice_date IS NULL
  AND proforma_invoice_amount IS NULL
  AND proforma_invoice_number IS NULL
  AND proforma_invoice_file IS NULL
  AND tax_invoice_date IS NULL
  AND tax_invoice_amount IS NULL
  AND tax_invoice_number IS NULL
  AND tax_invoice_file IS NULL
  AND receipt_invoice_date IS NULL
  AND receipt_invoice_amount IS NULL
  AND receipt_invoice_number IS NULL
  AND receipt_invoice_file IS NULL
  AND vat IS NULL
  AND withholding_tax IS NULL
  AND interest IS NULL;

SELECT
  full_supplier_name_outbound,
  count(*)
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  card = 2733
GROUP BY
  specific_date,
  deals_inbound,
  supplier_id,
  supplier_name,
  deal_sum_type,
  payment_sum_sign,
  purchase_date,
  full_purchase_date,
  more_info,
  horaat_keva,
  voucher_number,
  voucher_number_ratz,
  solek,
  purchase_date_outbound,
  full_purchase_date_outbound,
  currency_id,
  current_payment_currency,
  city,
  supplier_name_outbound,
  full_supplier_name_outbound,
  payment_date,
  full_payment_date,
  is_show_deals_outbound,
  adendum,
  voucher_number_ratz_outbound,
  is_show_link_for_supplier_details,
  deal_sum,
  payment_sum,
  full_supplier_name_heb,
  deal_sum_outbound,
  payment_sum_outbound,
  is_horaat_keva,
  stage,
  return_code,
  message,
  return_message,
  display_properties,
  table_page_num,
  is_error,
  is_captcha,
  is_button,
  site_name,
  client_ip_address
HAVING
  count(*) > 1;

--
-- delete from accounter_schema.isracard_creditcard_transactions
-- where card_index = 2;
SELECT
  *
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  specific_date IS NULL
  AND deals_inbound = $$yes$$
  AND supplier_id = 0594200
  AND supplier_name = $$ביר בזאר לוינסק$$
  AND deal_sum_type IS NULL
  AND payment_sum_sign IS NULL
  AND purchase_date = $$12/07$$
  AND full_purchase_date = '2018-07-12'
  AND (
    more_info = $$הנחה 2.12       ש"ח CASHBACK$$
    OR more_info = $$צבירת 2.12       ש"ח CASHBACK$$
  )
  AND horaat_keva IS NULL
  AND voucher_number = 0001012
  AND voucher_number_ratz = 757232438
  AND solek = $$L$$
  AND purchase_date_outbound IS NULL
  AND full_purchase_date_outbound IS NULL
  AND currency_id = $$ש"ח$$
  AND current_payment_currency IS NULL
  AND city IS NULL
  AND supplier_name_outbound IS NULL
  AND full_supplier_name_outbound IS NULL
  AND payment_date IS NULL
  AND full_payment_date IS NULL
  AND is_show_deals_outbound IS NULL
  AND adendum IS NULL
  AND voucher_number_ratz_outbound IS NULL
  AND is_show_link_for_supplier_details = $$yes$$
  AND deal_sum = $$105.80$$
  AND payment_sum = 103.68
  AND full_supplier_name_heb = $$ביר בזאר לוינסקי$$
  AND deal_sum_outbound IS NULL
  AND payment_sum_outbound IS NULL
  AND is_horaat_keva = $$false$$
  AND stage IS NULL
  AND return_code IS NULL
  AND message IS NULL
  AND return_message IS NULL
  AND display_properties IS NULL
  AND table_page_num = '0'
  AND is_error = $$false$$
  AND is_captcha = $$false$$
  AND is_button = $$false$$
  AND site_name IS NULL
  AND client_ip_address IS NULL
  AND card = 9217;

SELECT
  *
FROM
  accounter_schema.isracard_creditcard_transactions
WHERE
  specific_date IS NULL
  AND (
    more_info = $$הנחה 22.29      ש\"ח$$
    OR more_info = $$צבירת 22.29      ש\"ח$$
    OR more_info = $$הנחה 22.29      ש\"ח$$
  )
  AND horaat_keva IS NULL
  AND