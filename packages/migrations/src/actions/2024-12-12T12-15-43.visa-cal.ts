import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-12-12T12-15-43.visa-cal.sql',
  run: ({ sql }) => sql`
    BEGIN;

    CREATE TABLE IF NOT EXISTS accounter_schema.cal_transactions (
        id SERIAL PRIMARY KEY,
        trn_int_id VARCHAR(255),
        trn_numaretor INTEGER,
        merchant_name VARCHAR(255),
        trn_purchase_date VARCHAR(255),
        trn_amt DECIMAL(15,2),
        trn_currency_symbol VARCHAR(10),
        trn_type VARCHAR(255),
        trn_type_code VARCHAR(255),
        deb_crd_date VARCHAR(255),
        amt_before_conv_and_index DECIMAL(15,2),
        deb_crd_currency_symbol VARCHAR(10),
        merchant_address VARCHAR(255),
        merchant_phone_no VARCHAR(255),
        branch_code_desc VARCHAR(255),
        trans_card_present_ind BOOLEAN,
        cur_payment_num INTEGER,
        num_of_payments INTEGER,
        token_ind INTEGER,
        wallet_provider_code INTEGER,
        wallet_provider_desc VARCHAR(255),
        token_number_part4 VARCHAR(4),
        cash_account_trn_amt DECIMAL(15,2),
        charge_external_to_card_comment TEXT,
        refund_ind BOOLEAN,
        is_immediate_comment_ind BOOLEAN,
        is_immediate_hhk_ind BOOLEAN,
        is_margarita BOOLEAN,
        is_spread_paymenst_abroad BOOLEAN,
        trn_exac_way INTEGER,
        debit_spread_ind BOOLEAN,
        on_going_transactions_comment TEXT,
        early_payment_ind BOOLEAN,
        merchant_id VARCHAR(255),
        crd_ext_id_num_type_code VARCHAR(255),
        trans_source VARCHAR(255),
        is_abroad_transaction BOOLEAN,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT cal_transactions_trn_int_id_idx UNIQUE (trn_int_id)
    );

    CREATE INDEX cal_transactions_trn_int_id ON accounter_schema.cal_transactions(trn_int_id);

    ALTER TABLE accounter_schema.transactions_raw_list ADD cal_id uuid;

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
            (cal_id IS NOT NULL)::integer = 1
        );

    CREATE OR REPLACE FUNCTION accounter_schema.insert_cal_transaction_handler() 
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
        INSERT INTO accounter_schema.transactions_raw_list (cal_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        SELECT INTO account_id_var, owner_id_var
            id, owner
        FROM accounter_schema.financial_accounts 
        WHERE account_number = NEW.trn_int_id::TEXT;

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
            NEW.merchant_name,
            CAST(NEW.trn_currency_symbol as accounter_schema.currency),
            to_date(NEW.trn_purchase_date, 'DD/MM/YYYY'),
            to_date(NEW.deb_crd_date, 'DD/MM/YYYY'),
            NEW.trn_amt * -1,
            0
        );

        RETURN NEW;
    END;
    $func$;

    CREATE TRIGGER cal_transaction_insert_trigger
        AFTER INSERT ON accounter_schema.cal_transactions
        FOR EACH ROW
        EXECUTE FUNCTION accounter_schema.insert_cal_transaction_handler();

    COMMIT;
`,
} satisfies MigrationExecutor;
