import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-01-30T11-50-54.max-transactions-trigger-fix.sql',
  run: ({ sql }) => sql`
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
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
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

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            CONCAT_WS(' | ', NEW.merchant_name, NEW.comments),
            CAST(
                    (
                        CASE
                            WHEN NEW.original_currency = 'ILS' THEN 'ILS'
                            ELSE RAISE EXCEPTION 'Unknown currency: %', NEW.original_currency; END
                        ) as accounter_schema.currency
            ),
            NEW.purchase_date,
            NEW.payment_date,
            CASE  
                WHEN NEW.actual_payment_amount IS NULL THEN  
                    RAISE EXCEPTION 'Transaction amount cannot be null'  
                ELSE  
                    NEW.actual_payment_amount * -1  
            END,  
            0);

    RETURN NEW;
END ;
$$;
`,
} satisfies MigrationExecutor;
