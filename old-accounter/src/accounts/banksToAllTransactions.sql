SELECT DISTINCT
  text_code,
  english_action_desc,
  activity_description
FROM
  accounter_schema.poalim_ils_account_transactions;

UPDATE
  accounter_schema.all_transactions
SET
  is_conversion = TRUE
WHERE
  detailed_bank_description LIKE '%FOREX PURCHASE%'
  OR detailed_bank_description LIKE '%FOREX SALE%';

SELECT
  event_date,
  current_balance,
  bank_description,
  personal_category,
  event_amount,
  financial_entity,
  user_description
FROM
  accounter_schema.all_transactions
WHERE
  detailed_bank_description LIKE '%FOREX PURCHASE%'
  OR detailed_bank_description LIKE '%FOREX SALE%';

CREATE
OR REPLACE FUNCTION insert_creditcard_transaction_into_merged_table () RETURNS TRIGGER AS $$
BEGIN

    if (NEW.full_supplier_name_outbound <> 'TOTAL FOR DATE' OR
        NEW.full_supplier_name_outbound IS NULL)
        AND (NEW.full_supplier_name_outbound <> 'CASH ADVANCE FEE' OR
             NEW.full_supplier_name_outbound IS NULL)
        AND (NEW.supplier_name <> 'סך חיוב בש"ח:' OR
             NEW.supplier_name IS NULL)
        AND (NEW.supplier_name <> 'סך חיוב  ב-$:' OR
             NEW.supplier_name IS NULL) then

        INSERT INTO accounter_schema.all_transactions (
                                                       currency_code,
                                                       event_date,
                                                       debit_date,
                                                       event_amount,
                                                       bank_reference,
                                                       event_number,
                                                       account_number,
                                                       account_type,
                                                       is_conversion,
                                                       currency_rate,
                                                       contra_currency_code,
                                                       bank_description,
                                                       original_id,
                                                       id,
                                                       current_balance,
                                                       detailed_bank_description)

        VALUES (
                CAST ((CASE
                     WHEN NEW.currency_id = 'ש"ח' THEN 'ILS'
                     WHEN NEW.currency_id = 'NIS' THEN 'ILS'
                     WHEN NEW.currency_id = 'דולר' THEN 'USD'
                     -- use ILS as default:
                     WHEN NEW.currency_id = 'EUR' THEN 'EUR'
                     WHEN NEW.currency_id = 'USD' THEN 'USD'
                     WHEN NEW.currency_id = 'GBP' THEN 'GBP'
                     ELSE 'ILS' END
                    ) as currency),
                CASE
                    WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                    WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                    END,
                to_date(NEW.full_payment_date, 'DD/MM/YYYY'),
                CASE
                    WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                    WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                    END,
                CASE
                    WHEN NEW.voucher_number IS NULL THEN (NEW.voucher_number_ratz)
                    ELSE NEW.voucher_number
                END,
                CASE
                    WHEN NEW.voucher_number IS NULL THEN (NEW.voucher_number_ratz)
                    ELSE NEW.voucher_number
                END,
                NEW.card,
                'creditcard',
                FALSE,
                0,
                null::integer,
                CASE
                    WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                    WHEN NEW.full_supplier_name_heb IS NULL THEN (COALESCE(NEW.full_supplier_name_outbound, '') ||
                                                                  COALESCE('/' || NEW.city, ''))
                    END,
                NEW.id,
                gen_random_uuid(),
                0,
                CASE
                    WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                    WHEN NEW.full_supplier_name_heb IS NULL THEN (COALESCE(NEW.full_supplier_name_outbound, '') ||
                                                                  COALESCE('/' || NEW.city, ''))
                    END);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER
  new_isracard_transaction_insert_trigger ON accounter_schema.isracard_creditcard_transactions;

CREATE TRIGGER
  new_isracard_transaction_insert_trigger
AFTER
  INSERT ON accounter_schema.isracard_creditcard_transactions FOR EACH ROW
EXECUTE
  PROCEDURE insert_creditcard_transaction_into_merged_table ();

CREATE
OR REPLACE FUNCTION insert_ils_transaction_into_merged_table () RETURNS TRIGGER AS $$
BEGIN

    INSERT INTO accounter_schema.all_transactions (
                                                   currency_code,
                                                   event_date,
                                                   debit_date,
                                                   event_amount,
                                                   bank_reference,
                                                   event_number,
                                                   account_number,
                                                   account_type,
                                                   is_conversion,
                                                   currency_rate,
                                                   contra_currency_code,
                                                   bank_description,
                                                   original_id,
                                                   id,
                                                   current_balance,
                                                   detailed_bank_description)

    VALUES (
            'ILS',
            new.event_date::text::date,
            new.event_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.reference_number,
            new.expanded_event_date,
            new.account_number,
            'checking_ils',
            (new.text_code = 22 or new.text_code = 23),
            0,
            null::integer, -- maybe if I'll do a transfer it will also show up?
            new.activity_description,
            new.id,
            gen_random_uuid(),
            new.current_balance,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.beneficiary_details_data_party_name, ''),
                    ' ',
                    coalesce(new.beneficiary_details_data_message_detail, ''),
                    ' ',
                    coalesce(new.english_action_desc, '')
                ));
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER
  new_ils_transaction_insert_trigger
AFTER
  INSERT ON accounter_schema.poalim_ils_account_transactions FOR EACH ROW
EXECUTE
  PROCEDURE insert_ils_transaction_into_merged_table ();

CREATE
OR REPLACE FUNCTION insert_usd_transaction_into_merged_table () RETURNS TRIGGER AS $$
BEGIN

    INSERT INTO accounter_schema.all_transactions (
                                                   currency_code,
                                                   event_date,
                                                   debit_date,
                                                   event_amount,
                                                   bank_reference,
                                                   event_number,
                                                   account_number,
                                                   account_type,
                                                   is_conversion,
                                                   currency_rate,
                                                   contra_currency_code,
                                                   bank_description,
                                                   original_id,
                                                   id,
                                                   current_balance,
                                                   detailed_bank_description)

    VALUES (
            'USD',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.reference_number,
            new.event_number,
            new.account_number,
            'checking_usd',
            (new.rate_fixing_code <> 0),
            new.currency_rate,
            new.contra_currency_code,
            new.activity_description || COALESCE('/' || new.event_details, ''),
            new.id,
            gen_random_uuid(),
            new.current_balance,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
                ));
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER
  new_usd_transaction_insert_trigger
AFTER
  INSERT ON accounter_schema.poalim_usd_account_transactions FOR EACH ROW
EXECUTE
  PROCEDURE insert_usd_transaction_into_merged_table ();

CREATE
OR REPLACE FUNCTION insert_eur_transaction_into_merged_table () RETURNS TRIGGER AS $$
BEGIN

    INSERT INTO accounter_schema.all_transactions (
                                                   currency_code,
                                                   event_date,
                                                   debit_date,
                                                   event_amount,
                                                   bank_reference,
                                                   event_number,
                                                   account_number,
                                                   account_type,
                                                   is_conversion,
                                                   currency_rate,
                                                   contra_currency_code,
                                                   bank_description,
                                                   original_id,
                                                   id,
                                                   current_balance,
                                                   detailed_bank_description)

    VALUES (
            'EUR',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.reference_number,
            new.event_number,
            new.account_number,
            'checking_eur',
            (new.rate_fixing_code <> 0),
            new.currency_rate,
            new.contra_currency_code,
            new.activity_description || COALESCE('/' || new.event_details, ''),
            new.id,
            gen_random_uuid(),
            new.current_balance,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
                ));
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER
  new_eur_transaction_insert_trigger
AFTER
  INSERT ON accounter_schema.poalim_eur_account_transactions FOR EACH ROW
EXECUTE
  PROCEDURE insert_eur_transaction_into_merged_table ();

CREATE
OR REPLACE FUNCTION insert_gbp_transaction_into_merged_table () RETURNS TRIGGER AS $$
BEGIN

    INSERT INTO accounter_schema.all_transactions (
                                                   currency_code,
                                                   event_date,
                                                   debit_date,
                                                   event_amount,
                                                   bank_reference,
                                                   event_number,
                                                   account_number,
                                                   account_type,
                                                   is_conversion,
                                                   currency_rate,
                                                   contra_currency_code,
                                                   bank_description,
                                                   original_id,
                                                   id,
                                                   current_balance,
                                                   detailed_bank_description)

    VALUES (
            'GBP',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.reference_number,
            new.event_number,
            new.account_number,
            'checking_gbp',
            (new.rate_fixing_code <> 0),
            new.currency_rate,
            new.contra_currency_code,
            new.activity_description || COALESCE('/' || new.event_details, ''),
            new.id,
            gen_random_uuid(),
            new.current_balance,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
                ));
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER
  new_gbp_transaction_insert_trigger
AFTER
  INSERT ON accounter_schema.poalim_gbp_account_transactions FOR EACH ROW
EXECUTE
  PROCEDURE insert_gbp_transaction_into_merged_table ();
