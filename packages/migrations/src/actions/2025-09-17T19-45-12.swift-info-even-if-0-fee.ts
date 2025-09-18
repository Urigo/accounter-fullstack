import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-09-17T19-45-12.swift-info-even-if-0-fee.sql',
  run: ({ sql }) => sql`
create or replace function accounter_schema.insert_poalim_swift_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id                UUID;
    account_id_var           UUID;
    owner_id_var             UUID;
    charge_id_var            UUID = NULL;
    instructed_amount        NUMERIC;
    value_date_amount        NUMERIC;
    transaction_amount       NUMERIC;
    fee_amount               NUMERIC;
    currency_code            accounter_schema.currency;
    instructed_currency_code accounter_schema.currency;
    value_date_currency_code accounter_schema.currency;
    exchange_rate            NUMERIC;
    transaction_id_var       UUID = NULL;
BEGIN

    -- extract amount
    BEGIN
        instructed_amount := CASE
                                 WHEN NEW.swift_currency_instructed_amount_33b <> ' ' THEN REPLACE(
                                         RIGHT(NEW.swift_currency_instructed_amount_33b,
                                               LENGTH(NEW.swift_currency_instructed_amount_33b) - 3), ',',
                                         '.')::NUMERIC END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid instructed amount for SWIFT. got: [%]; error: %', NEW.swift_currency_instructed_amount_33b, SQLERRM;
    END;

    BEGIN
        value_date_amount := CASE
                                 WHEN NEW.swift_value_date_currency_amount_32a <> ' ' THEN REPLACE(
                                         RIGHT(NEW.swift_value_date_currency_amount_32a,
                                               LENGTH(NEW.swift_value_date_currency_amount_32a) - 9), ',',
                                         '.')::NUMERIC END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid value date amount for SWIFT. got: [%]; error: %', NEW.swift_value_date_currency_amount_32a, SQLERRM;
    END;

    transaction_amount := COALESCE(instructed_amount, value_date_amount);

    -- extract currency
    BEGIN
        instructed_currency_code := CASE
                                        WHEN NEW.swift_currency_instructed_amount_33b <> ' '
                                            THEN LEFT(NEW.swift_currency_instructed_amount_33b, 3)::accounter_schema.currency
            END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid instructed currency for SWIFT transaction. got: [%]; error: %', NEW.swift_currency_instructed_amount_33b, SQLERRM;
    END;

    BEGIN
        value_date_currency_code := CASE
                                        WHEN NEW.swift_value_date_currency_amount_32a <> ' '
                                            THEN RIGHT(LEFT(NEW.swift_value_date_currency_amount_32a,
                                                            9), 3)::accounter_schema.currency END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid value date currency for SWIFT transaction. got: [%]; error: %', NEW.swift_value_date_currency_amount_32a, SQLERRM;
    END;

    currency_code := COALESCE(instructed_currency_code, value_date_currency_code);

    --     handle multiple currencies
    BEGIN
        exchange_rate := CASE
                             WHEN NEW.swift_exchange_rate_36 <> ' '
                                 THEN REPLACE(NEW.swift_exchange_rate_36, ',', '.')::NUMERIC END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid exchange rate format in SWIFT fields. Got this: [%]; Error: %', NEW.swift_exchange_rate_36, SQLERRM;
    END;

    -- handle multiple currencies
    IF (instructed_amount IS NOT NULL AND value_date_currency_code <> instructed_currency_code) THEN
        IF (exchange_rate IS NULL) THEN
            RAISE EXCEPTION 'Invalid SWIFT transaction: multiple currencies without exchange rate. instructed amount: [%]; value date amount: [%]; exchange rate: [%]; Error: %', NEW.swift_currency_instructed_amount_33b, NEW.swift_value_date_currency_amount_32a, NEW.swift_exchange_rate_36, SQLERRM;
        END IF;
        transaction_amount := ROUND(instructed_amount * exchange_rate, 2);
    END IF;

    fee_amount := transaction_amount - value_date_amount;

    IF (fee_amount >= 0) THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (poalim_swift_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT;

        IF (account_id_var IS NULL) THEN
            RAISE EXCEPTION 'Account not found for account number: %', NEW.account_number;
        END IF;

        -- check if matching charge exists for source:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT formatted_value_date, event_details, id, currency, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
            AND s.formatted_value_date = NEW.formatted_start_date
            AND currency_code = s.currency
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
                                                   source_reference, counter_account, source_origin, origin_key)
        VALUES (account_id_var,
                charge_id_var,
                merged_id,
                CONCAT_WS(' ',
                          'Swift Fee:',
                          NEW.charge_party_name,
                          NEW.reference_number,
                          NEW.swift_remittance_information_70
                ),
                currency_code,
                NEW.formatted_start_date::DATE,
                NEW.formatted_start_date::DATE,
                fee_amount * -1,
                0,
                NULL,
                TRUE,
                NEW.reference_number,
                'SWIFT',
                'POALIM',
                NEW.id)
        RETURNING id INTO transaction_id_var;
    END IF;
    RETURN NEW;
END
$$;
`,
} satisfies MigrationExecutor;
