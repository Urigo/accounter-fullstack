import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-17T00-00-00.bank-mizrahi.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.bank_mizrahi_transactions (
        id uuid DEFAULT gen_random_uuid() NOT NULL
            CONSTRAINT bank_mizrahi_transactions_pk PRIMARY KEY,
        account_number VARCHAR(255) NOT NULL,
        transaction_identifier VARCHAR(255),
        date VARCHAR(255),
        processed_date VARCHAR(255),
        original_amount DECIMAL(15,2),
        original_currency VARCHAR(10),
        charged_amount DECIMAL(15,2),
        description VARCHAR(512),
        memo VARCHAR(512),
        status VARCHAR(50),
        type VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT bank_mizrahi_transactions_unique UNIQUE (account_number, transaction_identifier)
    );

    ALTER TABLE accounter_schema.transactions_raw_list ADD COLUMN bank_mizrahi_id uuid;

    ALTER TABLE accounter_schema.transactions_raw_list DROP CONSTRAINT transactions_raw_list_check;
    ALTER TABLE accounter_schema.transactions_raw_list ADD CONSTRAINT transactions_raw_list_check
        CHECK (
            (creditcard_id IS NOT NULL)::integer +
            (poalim_ils_id IS NOT NULL)::integer +
            (poalim_eur_id IS NOT NULL)::integer +
            (poalim_gbp_id IS NOT NULL)::integer +
            (poalim_usd_id IS NOT NULL)::integer +
            (poalim_swift_id IS NOT NULL)::integer +
            (kraken_id IS NOT NULL)::integer +
            (etana_id IS NOT NULL)::integer +
            (etherscan_id IS NOT NULL)::integer +
            (amex_id IS NOT NULL)::integer +
            (cal_id IS NOT NULL)::integer +
            (bank_discount_id IS NOT NULL)::integer +
            (bank_mizrahi_id IS NOT NULL)::integer = 1
        );

    CREATE OR REPLACE FUNCTION accounter_schema.insert_bank_mizrahi_transaction_handler()
        RETURNS trigger
        LANGUAGE plpgsql
    AS
    $func$
    DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
    BEGIN
        INSERT INTO accounter_schema.transactions_raw_list (bank_mizrahi_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        SELECT INTO account_id_var, owner_id_var
            id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number;

        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        INSERT INTO accounter_schema.transactions (
            account_id,
            charge_id,
            source_id,
            source_description,
            currency,
            event_date,
            debit_date,
            amount,
            current_balance
        )
        VALUES (
            account_id_var,
            charge_id_var,
            merged_id,
            NEW.description,
            COALESCE(NEW.original_currency, 'ILS')::accounter_schema.currency,
            to_date(NEW.date, 'YYYY-MM-DD'),
            to_date(NEW.processed_date, 'YYYY-MM-DD'),
            NEW.charged_amount * -1,
            NULL
        );
        RETURN NEW;
    END;
    $func$;

    CREATE TRIGGER bank_mizrahi_transaction_insert_trigger
        AFTER INSERT ON accounter_schema.bank_mizrahi_transactions
        FOR EACH ROW
        EXECUTE FUNCTION accounter_schema.insert_bank_mizrahi_transaction_handler();
`,
} satisfies MigrationExecutor;
