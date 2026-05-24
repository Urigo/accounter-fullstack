import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-18T12-00-00.add-otsar-hahayal-tables.sql',
  run: ({ sql }) => sql`
    CREATE TABLE accounter_schema.otsar_hahayal_ils_account_transactions (
      id                           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_id                     UUID        REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,

      -- account identity
      account_number               INTEGER     NOT NULL,
      account_type                 INTEGER     NOT NULL,
      branch_number                INTEGER     NOT NULL,

      -- IlsTransaction fields
      action_code                  INTEGER     NOT NULL,
      bfb_source                   VARCHAR(10) NOT NULL,
      closing_balance              NUMERIC     NOT NULL,
      correspondent_account        INTEGER     NOT NULL,
      correspondent_account_type   INTEGER     NOT NULL,
      correspondent_bank           INTEGER     NOT NULL,
      correspondent_branch         INTEGER     NOT NULL,
      credit_amount                NUMERIC     NOT NULL,
      customer_name                TEXT        NOT NULL,
      date_of_business_day         TIMESTAMPTZ NOT NULL,
      date_of_registration         TIMESTAMPTZ NOT NULL,
      debit_amount                 NUMERIC     NOT NULL,
      depositor_id                 INTEGER     NOT NULL,
      description                  TEXT        NOT NULL,
      drill_down_url               TEXT        NOT NULL,
      drill_down_data              JSONB,
      first_transaction_of_day     BOOLEAN     NOT NULL,
      last_transaction_of_day      BOOLEAN     NOT NULL,
      name                         TEXT        NOT NULL,
      opening_balance              NUMERIC     NOT NULL,
      operation_source              TEXT        NOT NULL,
      reference                    INTEGER     NOT NULL,
      salary_ind                   INTEGER     NOT NULL,
      transaction_source           TEXT        NOT NULL,
      transaction_reason           TEXT        NOT NULL,
      origin_reference             TEXT        NOT NULL DEFAULT ''
    );

    ALTER TABLE accounter_schema.otsar_hahayal_ils_account_transactions
      ENABLE ROW LEVEL SECURITY;

    ALTER TABLE accounter_schema.otsar_hahayal_ils_account_transactions
      FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.otsar_hahayal_ils_account_transactions
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    CREATE UNIQUE INDEX otsar_hahayal_ils_account_transactions_conflict_key
      ON accounter_schema.otsar_hahayal_ils_account_transactions (account_number, branch_number, date_of_registration, date_of_business_day, reference, origin_reference, credit_amount, debit_amount);

    CREATE INDEX otsar_hahayal_ils_account_transactions_owner_id_idx
      ON accounter_schema.otsar_hahayal_ils_account_transactions (owner_id);

    CREATE INDEX otsar_hahayal_ils_account_transactions_date_idx
      ON accounter_schema.otsar_hahayal_ils_account_transactions (date_of_business_day);


    CREATE TABLE accounter_schema.otsar_hahayal_foreign_account_transactions (
      id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_id         UUID        REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,

      -- metadata (from ForeignAccountMetadata)
      account          INTEGER     NOT NULL,
      branch           INTEGER     NOT NULL,
      account_type     TEXT        NOT NULL,
      currency         TEXT        NOT NULL,
      opening_balance  NUMERIC     NOT NULL,

      -- ForeignTransaction fields
      balance          NUMERIC,
      value_date       DATE        NOT NULL,
      credit           NUMERIC     NOT NULL,
      debit            NUMERIC     NOT NULL,
      description      TEXT        NOT NULL,
      sp               INTEGER,
      reference        TEXT        NOT NULL,
      date             DATE        NOT NULL,
      sub_transactions JSONB       NOT NULL DEFAULT '[]'
    );

    ALTER TABLE accounter_schema.otsar_hahayal_foreign_account_transactions
      ENABLE ROW LEVEL SECURITY;

    ALTER TABLE accounter_schema.otsar_hahayal_foreign_account_transactions
      FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.otsar_hahayal_foreign_account_transactions
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    CREATE UNIQUE INDEX otsar_hahayal_foreign_account_transactions_conflict_key
      ON accounter_schema.otsar_hahayal_foreign_account_transactions (account, branch, date, value_date, reference, description);

    CREATE INDEX otsar_hahayal_foreign_account_transactions_owner_id_idx
      ON accounter_schema.otsar_hahayal_foreign_account_transactions (owner_id);

    CREATE INDEX otsar_hahayal_foreign_account_transactions_date_idx
      ON accounter_schema.otsar_hahayal_foreign_account_transactions (date);


    -- Extend financial_account_type enum
    ALTER TYPE accounter_schema.financial_account_type ADD VALUE IF NOT EXISTS 'OTSAR_HAHAYAL';


    -- Add raw-list columns
    ALTER TABLE accounter_schema.transactions_raw_list
      ADD COLUMN otsar_hahayal_ils_id UUID
        REFERENCES accounter_schema.otsar_hahayal_ils_account_transactions ON DELETE CASCADE;

    ALTER TABLE accounter_schema.transactions_raw_list
      ADD COLUMN otsar_hahayal_foreign_id UUID
        REFERENCES accounter_schema.otsar_hahayal_foreign_account_transactions ON DELETE CASCADE;

    CREATE UNIQUE INDEX transactions_raw_list_otsar_hahayal_ils_id_uindex
      ON accounter_schema.transactions_raw_list (otsar_hahayal_ils_id)
      WHERE otsar_hahayal_ils_id IS NOT NULL;

    CREATE UNIQUE INDEX transactions_raw_list_otsar_hahayal_foreign_id_uindex
      ON accounter_schema.transactions_raw_list (otsar_hahayal_foreign_id)
      WHERE otsar_hahayal_foreign_id IS NOT NULL;

    -- Update the exactly-one-source check constraint to include the two new columns
    ALTER TABLE accounter_schema.transactions_raw_list
      DROP CONSTRAINT transactions_raw_list_check;

    ALTER TABLE accounter_schema.transactions_raw_list
      ADD CONSTRAINT transactions_raw_list_check CHECK (
        (creditcard_id            IS NOT NULL)::integer +
        (poalim_ils_id            IS NOT NULL)::integer +
        (poalim_foreign_id        IS NOT NULL)::integer +
        (poalim_swift_id          IS NOT NULL)::integer +
        (kraken_id                IS NOT NULL)::integer +
        (etana_id                 IS NOT NULL)::integer +
        (etherscan_id             IS NOT NULL)::integer +
        (amex_id                  IS NOT NULL)::integer +
        (cal_id                   IS NOT NULL)::integer +
        (bank_discount_id         IS NOT NULL)::integer +
        (max_creditcard_id        IS NOT NULL)::integer +
        (otsar_hahayal_ils_id     IS NOT NULL)::integer +
        (otsar_hahayal_foreign_id IS NOT NULL)::integer = 1
      );


    -- ILS insert trigger function
    CREATE OR REPLACE FUNCTION accounter_schema.insert_otsar_hahayal_ils_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_ils_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT AND account_type = 'OTSAR_HAHAYAL';

        -- 3. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        -- 4. transaction
        INSERT INTO accounter_schema.transactions (
            owner_id,
            account_id,
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
            counter_account,
            is_fee,
            origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(NEW.name), ''),
                NULLIF(TRIM(NEW.customer_name), ''),
                NULLIF(TRIM(NEW.description), ''),
                NULLIF(TRIM(NEW.transaction_reason), '')
            )), ''),
            'ILS'::accounter_schema.currency,
            NEW.date_of_registration::DATE,
            NEW.date_of_business_day::DATE,
            CASE
                WHEN NEW.debit_amount <> 0 THEN NEW.debit_amount * -1
                ELSE NEW.credit_amount
            END,
            NEW.closing_balance,
            NEW.reference::TEXT,
            'OTSAR_HAHAYAL',
            CASE
                WHEN NEW.correspondent_account <> 0 THEN CONCAT(
                    NEW.correspondent_bank, '-',
                    NEW.correspondent_branch, '-',
                    NEW.correspondent_account,
                    ' (', NEW.correspondent_account_type, ')'
                )
                ELSE NULL
            END,
            FALSE,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;

    CREATE TRIGGER insert_otsar_hahayal_ils_transaction
      AFTER INSERT ON accounter_schema.otsar_hahayal_ils_account_transactions
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_otsar_hahayal_ils_transaction_handler();


    -- Foreign insert trigger function
    CREATE OR REPLACE FUNCTION accounter_schema.insert_otsar_hahayal_foreign_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_foreign_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account::TEXT AND account_type = 'OTSAR_HAHAYAL';

        -- 3. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        -- 4. transaction
        INSERT INTO accounter_schema.transactions (
            owner_id,
            account_id,
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
            counter_account,
            is_fee,
            origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(NEW.description), ''),
            NEW.currency::accounter_schema.currency,
            NEW.value_date,
            NEW.date,
            CASE
                WHEN NEW.debit <> 0 THEN NEW.debit * -1
                ELSE NEW.credit
            END,
            COALESCE(NEW.balance, 0),
            NEW.reference,
            'OTSAR_HAHAYAL',
            NULL,
            FALSE,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;

    CREATE TRIGGER insert_otsar_hahayal_foreign_transaction
      AFTER INSERT ON accounter_schema.otsar_hahayal_foreign_account_transactions
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_otsar_hahayal_foreign_transaction_handler();
  `,
} satisfies MigrationExecutor;
