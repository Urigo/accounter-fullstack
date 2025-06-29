import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-06-28T13-12-45.fix-poalim-swift-trigger-function.sql',
  run: ({ sql }) => sql`
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
    transaction_amount := CASE
                              WHEN NEW.swift_currency_instructed_amount_33b <> ' ' THEN REPLACE(
                                      RIGHT(NEW.swift_currency_instructed_amount_33b,
                                            LENGTH(NEW.swift_currency_instructed_amount_33b) - 3), ',',
                                      '.')::NUMERIC
                              ELSE REPLACE(
                                      RIGHT(NEW.swift_value_date_currency_amount_32a,
                                            LENGTH(NEW.swift_value_date_currency_amount_32a) - 9), ',',
                                      '.')::NUMERIC END;
    fee_amount := transaction_amount - REPLACE(
            RIGHT(NEW.swift_value_date_currency_amount_32a, LENGTH(NEW.swift_value_date_currency_amount_32a) - 9), ',',
            '.')::NUMERIC;
    currency_code := CASE
                         WHEN NEW.swift_currency_instructed_amount_33b <> ' '
                             THEN LEFT(NEW.swift_currency_instructed_amount_33b, 3)::accounter_schema.currency
                         ELSE RIGHT(LEFT(NEW.swift_value_date_currency_amount_32a,
                                         9), 3)::accounter_schema.currency END;

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
        FROM (SELECT formatted_value_date, event_details, id, currency, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
            AND (s.formatted_value_date = NEW.formatted_start_date
                OR s.formatted_value_date = NEW.formatted_end_date)
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
                                                   source_reference, counter_account, source_origin, origin_key)
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
                'SWIFT',
                'POALIM',
                NEW.id)
        RETURNING id INTO transaction_id_var;
    END IF;
    RETURN NEW;
END;
$$;
`,
} satisfies MigrationExecutor;
