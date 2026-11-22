import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Payoneer account activity, one row per Payoneer activity item (incoming payment, withdrawal to a
 * bank account, ...), as returned by the account's activity details
 * (`gw-activity/api/activity/getItemDetailsRawData`).
 *
 * Payoneer has no API for account holders, so rows are uploaded through
 * `uploadPayoneerTransactions` from the activity details of a signed-in session.
 *
 * Amounts follow the balance: `amount` is the change to the Payoneer balance, fee included, and
 * `fee` is the (negative) fee Payoneer took out of it. So an incoming payment of 1,000 with a 1% fee
 * is `amount = 990, fee = -10`, and a withdrawal of 500 of which 490 reached the bank is
 * `amount = -500, fee = -10`.
 *
 * Like Etana and Kraken, each row becomes two transactions on one charge: the main movement
 * (`amount - fee`: the gross payment, or the amount sent to the bank) and, when there is a fee, a
 * fee transaction (`is_fee`) whose counterparty is the tenant's Payoneer business
 * (`user_context.payoneer_business_id`), which joins the internal wallets so the ledger books the
 * fee against the Payoneer account itself.
 *
 * The Payoneer account is a `BANK_ACCOUNT` financial account whose `account_number` is the
 * Payoneer account holder ID; it is matched within the uploading owner.
 *
 * RLS follows `2026-10-21T14-00-00.charges-securities-executions`.
 */
export default {
  name: '2026-11-22T14-00-00.add-payoneer-transactions.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.payoneer_transactions (
      id                  UUID        NOT NULL DEFAULT uuidv7() PRIMARY KEY,
      owner_id            UUID        NOT NULL
                                      REFERENCES accounter_schema.businesses (id) ON DELETE CASCADE,

      -- Payoneer account holder ID (activityMainData.EntityId)
      account_id          TEXT        NOT NULL,

      -- activityMainData
      transaction_id      TEXT        NOT NULL,
      activity_type       INTEGER     NOT NULL,
      status              INTEGER,
      activity_date       TIMESTAMPTZ NOT NULL,
      currency            TEXT        NOT NULL,
      amount              NUMERIC     NOT NULL,
      fee                 NUMERIC     NOT NULL DEFAULT 0,
      balance             NUMERIC,
      description         TEXT        NOT NULL,

      -- activityDetails
      counterparty_name   TEXT,
      payment_description TEXT,
      receiving_account   TEXT,
      transfer_id         TEXT,
      target_account      TEXT,
      gross_amount        NUMERIC,
      amount_sent         NUMERIC,

      raw_data            JSONB,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT payoneer_transactions_natural_key UNIQUE (owner_id, account_id, transaction_id)
    );

    COMMENT ON TABLE accounter_schema.payoneer_transactions IS
      'Payoneer account activity items; amount is the balance change (fee included), fee is negative';

    CREATE INDEX IF NOT EXISTS payoneer_transactions_owner_id_idx
      ON accounter_schema.payoneer_transactions (owner_id);

    CREATE INDEX IF NOT EXISTS payoneer_transactions_activity_date_idx
      ON accounter_schema.payoneer_transactions (activity_date);

    ALTER TABLE accounter_schema.payoneer_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.payoneer_transactions FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.payoneer_transactions;
    CREATE POLICY tenant_isolation ON accounter_schema.payoneer_transactions
      FOR ALL
      USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.payoneer_transactions;
    CREATE POLICY tenant_isolation_delete ON accounter_schema.payoneer_transactions
      AS RESTRICTIVE
      FOR DELETE
      USING (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_update ON accounter_schema.payoneer_transactions;
    CREATE POLICY tenant_isolation_update ON accounter_schema.payoneer_transactions
      AS RESTRICTIVE
      FOR UPDATE
      USING (owner_id = accounter_schema.get_current_business_id());


    -- Provider business: counterparty of Payoneer fees, and an internal wallet
    ALTER TABLE accounter_schema.user_context
      ADD COLUMN IF NOT EXISTS payoneer_business_id UUID
        CONSTRAINT user_context_businesses_id_fk_22
          REFERENCES accounter_schema.businesses;


    -- Raw-list column
    ALTER TABLE accounter_schema.transactions_raw_list
      ADD COLUMN IF NOT EXISTS payoneer_id UUID
        REFERENCES accounter_schema.payoneer_transactions ON DELETE CASCADE;

    CREATE UNIQUE INDEX IF NOT EXISTS transactions_raw_list_payoneer_id_uindex
      ON accounter_schema.transactions_raw_list (payoneer_id)
      WHERE payoneer_id IS NOT NULL;

    ALTER TABLE accounter_schema.transactions_raw_list
      DROP CONSTRAINT transactions_raw_list_check;

    ALTER TABLE accounter_schema.transactions_raw_list
      ADD CONSTRAINT transactions_raw_list_check CHECK (
        (creditcard_id                   IS NOT NULL)::integer +
        (poalim_ils_id                   IS NOT NULL)::integer +
        (poalim_foreign_id               IS NOT NULL)::integer +
        (poalim_swift_id                 IS NOT NULL)::integer +
        (kraken_id                       IS NOT NULL)::integer +
        (etana_id                        IS NOT NULL)::integer +
        (etherscan_id                    IS NOT NULL)::integer +
        (amex_id                         IS NOT NULL)::integer +
        (cal_id                          IS NOT NULL)::integer +
        (bank_discount_id                IS NOT NULL)::integer +
        (max_creditcard_id               IS NOT NULL)::integer +
        (otsar_hahayal_ils_id            IS NOT NULL)::integer +
        (otsar_hahayal_foreign_id        IS NOT NULL)::integer +
        (otsar_hahayal_creditcard_id     IS NOT NULL)::integer +
        (payoneer_id                     IS NOT NULL)::integer = 1
      );


    -- Insert trigger: one charge per activity item, a main transaction and an optional fee one
    CREATE OR REPLACE FUNCTION accounter_schema.insert_payoneer_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id            UUID;
        account_id_var       UUID;
        owner_id_var         UUID;
        charge_id_var        UUID;
        fee_business_id_var  UUID;
        currency_var         accounter_schema.currency;
        local_timestamp_var  TIMESTAMP;
        description_var      TEXT;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (payoneer_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner (the Payoneer account holder ID, within the uploading owner)
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_id
          AND type = 'BANK_ACCOUNT'
          AND owner = NEW.owner_id;

        IF account_id_var IS NULL OR owner_id_var IS NULL THEN
            RAISE EXCEPTION 'Financial account not found or has no owner for Payoneer account: %', NEW.account_id;
        END IF;

        currency_var := NEW.currency::accounter_schema.currency;
        local_timestamp_var := NEW.activity_date AT TIME ZONE 'Asia/Jerusalem';
        description_var := NULLIF(TRIM(CONCAT_WS(' | ',
            NULLIF(TRIM(NEW.description), ''),
            NULLIF(TRIM(NEW.payment_description), '')
        )), '');

        SELECT payoneer_business_id
        INTO fee_business_id_var
        FROM accounter_schema.user_context
        WHERE owner_id = owner_id_var;

        -- 3. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        -- 4. main transaction: the gross payment / the amount sent, before Payoneer's fee
        INSERT INTO accounter_schema.transactions (
            owner_id,
            account_id,
            charge_id,
            source_id,
            source_description,
            currency,
            event_date,
            debit_date,
            debit_timestamp,
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
            description_var,
            currency_var,
            local_timestamp_var::DATE,
            local_timestamp_var::DATE,
            local_timestamp_var,
            NEW.amount - NEW.fee,
            COALESCE(NEW.balance, 0) - NEW.fee,
            NEW.transaction_id,
            'PAYONEER',
            NEW.target_account,
            FALSE,
            NEW.id::TEXT
        );

        -- 5. fee transaction
        IF NEW.fee <> 0 THEN
            INSERT INTO accounter_schema.transactions (
                owner_id,
                account_id,
                charge_id,
                source_id,
                source_description,
                currency,
                event_date,
                debit_date,
                debit_timestamp,
                amount,
                current_balance,
                business_id,
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
                CONCAT('Payoneer fee: ', description_var),
                currency_var,
                local_timestamp_var::DATE,
                local_timestamp_var::DATE,
                local_timestamp_var,
                NEW.fee,
                COALESCE(NEW.balance, 0),
                fee_business_id_var,
                NEW.transaction_id,
                'PAYONEER',
                'PAYONEER_fee',
                TRUE,
                NEW.id::TEXT || '_fee'
            );
        END IF;

        RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS insert_payoneer_transaction ON accounter_schema.payoneer_transactions;
    CREATE TRIGGER insert_payoneer_transaction
      AFTER INSERT ON accounter_schema.payoneer_transactions
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_payoneer_transaction_handler();
  `,
} satisfies MigrationExecutor;
