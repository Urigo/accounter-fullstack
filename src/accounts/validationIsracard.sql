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
    FROM accounter_schema.isracard_creditcard_transactions
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


-- 1241
delete
from accounter_schema.isracard_creditcard_transactions
where
    card = 2733 and
    card_index = 1 and
     user_description is null and
       financial_entity is null and
       business_trip is null and
       personal_category is null and
       tax_category is null and
       even_with_dotan is null and
       proforma_invoice_date is null and
       proforma_invoice_amount is null and
       proforma_invoice_number is null and
       proforma_invoice_file is null and
       tax_invoice_date is null and
       tax_invoice_amount is null and
       tax_invoice_number is null and
       tax_invoice_file is null and
       receipt_invoice_date is null and
       receipt_invoice_amount is null and
       receipt_invoice_number is null and
       receipt_invoice_file is null and
       vat is null and
       withholding_tax is null and
       interest is null;

select full_supplier_name_outbound,count(*)
from accounter_schema.isracard_creditcard_transactions
where card = 2733
group by
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
HAVING count(*) > 1;

--
-- delete from accounter_schema.isracard_creditcard_transactions
-- where card_index = 2;


SELECT * FROM accounter_schema.isracard_creditcard_transactions
WHERE
      specific_date IS NULL AND
      deals_inbound = $$yes$$ AND
      supplier_id = 0594200 AND
      supplier_name = $$ביר בזאר לוינסק$$ AND
      deal_sum_type IS NULL AND
      payment_sum_sign IS NULL AND
      purchase_date = $$12/07$$ AND
      full_purchase_date = '2018-07-12' AND
      (
       more_info = $$הנחה 2.12       ש"ח CASHBACK$$ OR
       more_info = $$צבירת 2.12       ש"ח CASHBACK$$
      ) and
      horaat_keva IS NULL AND
      voucher_number = 0001012 AND
      voucher_number_ratz = 757232438 AND
      solek = $$L$$ AND
      purchase_date_outbound IS NULL AND
      full_purchase_date_outbound IS NULL AND
      currency_id = $$ש"ח$$ AND
      current_payment_currency IS NULL AND
      city IS NULL AND
      supplier_name_outbound IS NULL AND
      full_supplier_name_outbound IS NULL AND
      payment_date IS NULL AND
      full_payment_date IS NULL AND
      is_show_deals_outbound IS NULL AND
      adendum IS NULL AND
      voucher_number_ratz_outbound IS NULL AND
      is_show_link_for_supplier_details = $$yes$$ AND
      deal_sum = $$105.80$$ AND
      payment_sum = 103.68 AND
      full_supplier_name_heb = $$ביר בזאר לוינסקי$$ AND
      deal_sum_outbound IS NULL AND
      payment_sum_outbound IS NULL AND
      is_horaat_keva = $$false$$ AND
      stage IS NULL AND
      return_code IS NULL AND
      message IS NULL AND
      return_message IS NULL AND
      display_properties IS NULL AND
      table_page_num = '0' AND
      is_error = $$false$$ AND
      is_captcha = $$false$$ AND
      is_button = $$false$$ AND
      site_name IS NULL AND
      client_ip_address IS NULL AND
      card = 9217;


SELECT * FROM accounter_schema.isracard_creditcard_transactions
WHERE
      specific_date IS NULL AND
      (
          more_info = $$הנחה 22.29      ש\"ח$$ OR
          more_info = $$צבירת 22.29      ש\"ח$$ OR
          more_info = $$הנחה 22.29      ש\"ח$$
          ) AND    horaat_keva IS NULL AND