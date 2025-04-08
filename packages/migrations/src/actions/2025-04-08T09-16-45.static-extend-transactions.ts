import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-04-08T09-16-45.static-extend-transactions.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.transactions
    add is_fee boolean default false not null;

alter table accounter_schema.transactions
    add source_reference text;

alter table accounter_schema.transactions
    add source_origin text;

alter table accounter_schema.transactions
    add counter_account text;

alter table accounter_schema.transactions
    add debit_timestamp timestamp;

alter table accounter_schema.transactions
    add currency_rate numeric;

alter table accounter_schema.transactions
    add currency_rate numeric default 0 not null;

UPDATE accounter_schema.transactions t
SET is_fee = et.is_fee,
    source_reference = et.source_reference,
    source_origin = et.source_origin,
    counter_account = et.counter_account,
    debit_timestamp = et.debit_timestamp,
    currency_rate = et.currency_rate
FROM accounter_schema.extended_transactions et
WHERE et.id = t.id;

create function accounter_schema.insert_creditcard_transaction_handler() returns trigger
    language plpgsql
as
$$
      DECLARE
          merged_id UUID;
          account_id_var UUID;
          owner_id_var UUID;
          charge_id_var UUID = NULL;
      BEGIN
          -- filter summarize records
          IF (
                  NEW.full_supplier_name_outbound NOT IN ('TOTAL FOR DATE', 'CASH ADVANCE FEE')
                  OR NEW.full_supplier_name_outbound IS NULL
              ) AND (
                  (NEW.supplier_name NOT IN ('סך חיוב בש"ח:', 'סך חיוב  ב-$:')
                  AND NOT (NEW.supplier_name IN ('דמי כרטיס הנחה', 'פועלים- דמי כרט') AND NEW.payment_sum = 0.00))
                  OR NEW.supplier_name IS NULL
              )
          THEN
              -- Create merged raw transactions record:
              INSERT INTO accounter_schema.transactions_raw_list (creditcard_id)
              VALUES (NEW.id)
              RETURNING id INTO merged_id;

              -- get account and owner IDs
              SELECT INTO account_id_var, owner_id_var
                  id, owner
              FROM accounter_schema.financial_accounts
              WHERE account_number = NEW.card::TEXT;

              -- check if matching charge exists:
              -- TBD

              -- create new charge
              IF (charge_id_var IS NULL) THEN
                  INSERT INTO accounter_schema.charges (owner_id)
                  VALUES (
                      owner_id_var
                  )
                  RETURNING id INTO charge_id_var;
              END IF;

              -- check if new record is fee
              -- TBD

              -- check if new record contains fees
              -- TBD

              -- create new transaction
              INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance)
              VALUES (
                  account_id_var,
                  charge_id_var,
                  merged_id,
                  CASE
                      WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                      WHEN NEW.full_supplier_name_heb IS NULL THEN (
                          COALESCE(NEW.full_supplier_name_outbound, '') ||
                          COALESCE('/' || NEW.city, '')
                      )
                  END,
                  CAST (
                    (
                        CASE
                            WHEN NEW.currency_id = 'ש"ח' THEN 'ILS'
                            WHEN NEW.currency_id = 'NIS' THEN 'ILS'
                            WHEN NEW.currency_id = 'דולר' THEN 'USD'
                            WHEN NEW.currency_id = 'USD' THEN 'USD'
                            WHEN NEW.currency_id = 'EUR' THEN 'EUR'
                            WHEN NEW.currency_id = 'GBP' THEN 'GBP'
                            -- use ILS as default:
                            ELSE 'ILS' END
                      ) as accounter_schema.currency
                  ),
                  CASE
                      WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                      WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                  END,
                  to_date(COALESCE(NEW.full_payment_date, NEW.charging_date), 'DD/MM/YYYY'),
                  CASE
                      WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                      WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                  END,
                  0
              );
          END IF;

          RETURN NEW;
      END;
      $$;

create or replace function accounter_schema.insert_amex_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- filter summarize records
    IF (
           NEW.full_supplier_name_outbound NOT IN ('TOTAL FOR DATE', 'CASH ADVANCE FEE')
               OR NEW.full_supplier_name_outbound IS NULL
           ) AND (
           (NEW.supplier_name NOT IN ('סך חיוב בש"ח:', 'סך חיוב  ב-$:')
               AND NOT (NEW.supplier_name IN ('דמי כרטיס הנחה', 'פועלים- דמי כרט') AND NEW.payment_sum = 0.00))
               OR NEW.supplier_name IS NULL
           )
    THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (amex_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.card::TEXT;

        -- check if matching charge exists:
        -- TBD

        -- create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        -- TBD

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, source_reference,
                                                   source_origin, counter_account)
        VALUES (account_id_var,
                charge_id_var,
                merged_id,
                CASE
                    WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                    WHEN NEW.full_supplier_name_heb IS NULL THEN (
                        COALESCE(NEW.full_supplier_name_outbound, '') ||
                        COALESCE('/' || NEW.city, '')
                        )
                    END,
                CAST(
                        (
                            CASE
                                WHEN NEW.currency_id = 'ש"ח' THEN 'ILS'
                                WHEN NEW.currency_id = 'NIS' THEN 'ILS'
                                WHEN NEW.currency_id = 'דולר' THEN 'USD'
                                WHEN NEW.currency_id = 'USD' THEN 'USD'
                                WHEN NEW.currency_id = 'EUR' THEN 'EUR'
                                WHEN NEW.currency_id = 'GBP' THEN 'GBP'
                                -- use ILS as default:
                                ELSE 'ILS' END
                            ) as accounter_schema.currency
                ),
                CASE
                    WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                    WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                    END,
                to_date(COALESCE(NEW.full_payment_date, NEW.charging_date), 'DD/MM/YYYY'),
                CASE
                    WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                    WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                    END,
                0,
                COALESCE(NEW.voucher_number::text,
                         NEW.voucher_number_ratz::text),
                'AMEX',
                CASE
                    WHEN NEW.supplier_id IS NOT NULL AND
                         NEW.supplier_id <> 0
                        THEN NEW.supplier_id::text::character varying
                    ELSE NEW.full_supplier_name_outbound
                    END);
    END IF;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_max_creditcard_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- filter summarize records
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (max_creditcard_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT id, owner
    INTO account_id_var, owner_id_var
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.short_card_number;

    IF account_id_var IS NULL THEN
        RAISE EXCEPTION 'No matching account found for card number: %', NEW.short_card_number;
    END IF;

    -- check if matching charge exists:
    -- TBD

    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    -- TBD

    -- check if new record contains fees
    -- TBD

    IF NOT (NEW.original_currency = 'ILS') THEN
        RAISE EXCEPTION 'Unknown currency: %', NEW.original_currency;
    END IF;

    IF (NEW.actual_payment_amount IS NULL) THEN
        RAISE EXCEPTION 'Transaction amount cannot be null';
    END IF;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               currency_rate, debit_timestamp, source_origin, counter_account)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            CONCAT_WS(' | ', NEW.merchant_name, NEW.comments),
            CAST(
                    (
                        CASE
                            WHEN NEW.original_currency = 'ILS' THEN 'ILS'
                            -- use ILS as default:
                            ELSE 'ILS' END
                        ) as accounter_schema.currency
            ),
            NEW.purchase_date,
            NEW.payment_date,
            NEW.actual_payment_amount * -1,
            0,
            NEW.arn,
            NEW.deal_data_exchange_rate,
            NEW.payment_date +
            NEW.deal_data_purchase_time,
            'MAX',
            CASE
                WHEN NEW.merchant_tax_id::text <> ''::text
                    THEN NEW.merchant_tax_id::text
                ELSE NEW.merchant_name
                END);

    RETURN NEW;
END ;
$$;

create or replace function accounter_schema.insert_poalim_ils_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_ils_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (22, 23)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_usd_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (
        (new.activity_type_code = 452 AND new.text_code IN (105, 547))
            OR (new.activity_type_code = 473 AND new.text_code IN (378, 395, 437, 502, 602, 603, 716, 771, 774))
        ) THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               source_origin, counter_account, is_fee)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.beneficiary_details_data_party_name, ''),
                    ' ',
                    coalesce(new.beneficiary_details_data_message_detail, ''),
                    ' ',
                    coalesce(new.english_action_desc, '')
            ),
            'ILS',
            new.event_date::text::date,
            new.event_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            new.reference_number::text,
            'POALIM',
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END,
            is_fee)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_eur_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_eur_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code in (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_usd_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'EUR',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_gbp_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_gbp_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_usd_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id,
                                       tr.poalim_usd_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'GBP',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_cad_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_cad_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- handle bank deposits
    IF (new.activity_type_code IN (1376, 1384, 169, 171, 172)) THEN
        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (113, 117, 457)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'CAD',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_usd_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_usd_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id,
                                       tr.poalim_usd_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- handle bank deposits
    IF (new.activity_type_code IN (1376, 1384, 169, 171, 172)) THEN
        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (113, 117, 457)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'USD',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_swift_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID = NULL;
    transaction_amount NUMERIC;
    fee_amount         NUMERIC;
    currency_code      accounter_schema.currency;
    transaction_id_var UUID = NULL;
BEGIN
    transaction_amount := REPLACE(
            RIGHT(NEW.swift_currency_instructed_amount_33b, LENGTH(NEW.swift_currency_instructed_amount_33b) - 3), ',',
            '.')::NUMERIC;
    fee_amount := transaction_amount - REPLACE(
            RIGHT(NEW.swift_value_date_currency_amount_32a, LENGTH(NEW.swift_value_date_currency_amount_32a) - 9), ',',
            '.')::NUMERIC;
    currency_code := LEFT(NEW.swift_currency_instructed_amount_33b, 3)::accounter_schema.currency;

    IF (fee_amount > 0) THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (poalim_swift_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT;

        -- check if matching charge exists for source:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT formatted_value_date, event_details, id, 'GBP' as currency, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              UNION
              SELECT formatted_value_date, event_details, id, 'EUR', event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              UNION
              SELECT formatted_value_date, event_details, id, 'CAD', event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              UNION
              SELECT formatted_value_date, event_details, id, 'USD', event_amount
              FROM accounter_schema.poalim_usd_account_transactions) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id,
                                       tr.poalim_usd_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
            AND (s.formatted_value_date = NEW.formatted_start_date
                OR s.formatted_value_date = NEW.formatted_start_date)
            AND currency_code::text = s.currency
            AND (s.event_details LIKE '%' || TRIM(LEFT(NEW.charge_party_name, 13)) || '%'
                AND NEW.amount::NUMERIC = s.event_amount)
           OR (transaction_amount * -1 = s.event_amount);

        -- if no match, create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        -- create new transaction for fee
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, business_id, is_fee,
                                                   source_reference, counter_account)
        VALUES (account_id_var,
                charge_id_var,
                merged_id,
                CONCAT_WS(' ',
                          'Swift Fee:',
                          NEW.charge_party_name,
                          NEW.reference_number
                ),
                currency_code,
                NEW.formatted_start_date::DATE,
                new.formatted_start_date::DATE,
                fee_amount * -1,
                0,
                NULL,
                TRUE,
                NEW.reference_number,
                'SWIFT')
        RETURNING id INTO transaction_id_var;
    END IF;
    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_deposit_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID = NULL;
    transaction_id_var UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_deposit_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = CONCAT('poalim_deposit_', NEW.deposit_key::TEXT);

    -- create new charge
    INSERT INTO accounter_schema.charges (owner_id, type)
    VALUES (owner_id_var, 'BANK_DEPOSIT'::accounter_schema.charge_type)
    RETURNING id INTO charge_id_var;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               source_origin)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            new.currency,
            new.date::text::date,
            new.date::text::date,
            new.amount, 0,
            NEW.deposit_key,
            'POALIM')
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_cal_creditcard_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (cal_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.card::TEXT;

    -- check if matching charge exists:
    -- TBD

    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    -- TBD

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id,
                                               charge_id,
                                               source_id,
                                               source_description,
                                               currency,
                                               event_date,
                                               debit_date,
                                               amount,
                                               current_balance,
                                               source_reference,
                                               source_origin,
                                               counter_account)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            NEW.merchant_name,
            CAST(NEW.trn_currency_symbol as accounter_schema.currency),
            to_date(NEW.trn_purchase_date, 'DD/MM/YYYY'),
            to_date(NEW.deb_crd_date, 'DD/MM/YYYY'),
            NEW.trn_amt * -1,
            0,
            NEW.trn_int_id,
            'CAL',
            COALESCE(NEW.merchant_id,
                     NEW.merchant_name));

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_bank_discount_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (bank_discount_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;
    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number
      AND branch_number = NEW.operation_branch
      AND bank_number = NEW.operation_bank;
    -- check if matching charge exists:
    -- TBD
    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;
    -- check if new record is fee
    -- TBD
    -- check if new record contains fees
    -- TBD
    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id,
                                               charge_id,
                                               source_id,
                                               source_description,
                                               currency,
                                               event_date,
                                               debit_date,
                                               amount,
                                               current_balance,
                                               source_reference,
                                               source_origin,
                                               counter_account)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            NEW.operation_description,
            'ILS'::accounter_schema.currency,
            to_date(NEW.operation_date, 'DD/MM/YYYY'),
            to_date(NEW.value_date, 'DD/MM/YYYY'),
            NEW.operation_amount * -1,
            NEW.balance_after_operation,
            NEW.urn,
            'BANK_DISCOUNT',
            CASE
                WHEN NEW.operation_number IS NOT NULL AND
                     NEW.operation_number <> 0 THEN concat(
                        NEW.operation_bank, '-',
                        NEW.operation_branch, '-',
                        NEW.operation_number)
                ELSE NULL::text
                END);
    RETURN NEW;
END;
$$;
`,
} satisfies MigrationExecutor;
