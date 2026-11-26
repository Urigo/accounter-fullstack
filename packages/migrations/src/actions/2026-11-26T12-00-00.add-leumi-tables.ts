import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Raw tables for Bank Leumi: shekel account, foreign-currency accounts and bank-issued
 * credit cards. As with the other scrapers, a row inserted here becomes a transaction (and
 * its charge) through an insert trigger.
 *
 * The triggers find the financial account by number within the row's own business. They
 * do not lean on row-level security for that, so two businesses holding the same account
 * number cannot pick up each other's account, whatever role runs the insert. They refuse
 * the row when there is no such account,
 * so a scrape of an account that was never set up fails with a message that says which
 * account is missing, instead of a NOT NULL violation on transactions.account_id.
 */
export default {
  name: '2026-11-26T12-00-00.add-leumi-tables.sql',
  run: ({ sql }) => sql`
    -- ── Shekel account ────────────────────────────────────────────────────────

    CREATE TABLE accounter_schema.leumi_ils_account_transactions (
      id                        UUID    NOT NULL DEFAULT uuidv7() PRIMARY KEY,
      owner_id                  UUID    NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,

      -- full account number, as in financial_accounts.account_number
      account_number            TEXT    NOT NULL,

      date                      DATE    NOT NULL,
      effective_date            DATE    NOT NULL,
      amount                    NUMERIC NOT NULL,
      credit                    NUMERIC NOT NULL,
      debit                     NUMERIC NOT NULL,
      description               TEXT    NOT NULL,
      additional_data           TEXT,
      running_balance           NUMERIC NOT NULL,
      reference_number          BIGINT  NOT NULL,
      check_number              BIGINT  NOT NULL,
      -- the bank's reference for the row; several rows can share one
      fitid                     TEXT    NOT NULL,
      type_code                 INTEGER NOT NULL,
      additional_activity_type  INTEGER NOT NULL,
      extension_type_code       INTEGER NOT NULL,
      segmentation_flag         INTEGER NOT NULL,
      credit_card_index         INTEGER NOT NULL,
      if_link                   INTEGER NOT NULL
    );

    ALTER TABLE accounter_schema.leumi_ils_account_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.leumi_ils_account_transactions FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.leumi_ils_account_transactions
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    -- fitid alone repeats; with the amount and the balance after the row it does not.
    -- Every conflict key starts with owner_id: a unique index spans all businesses, so
    -- without it a second business holding the same account would have its rows skipped.
    CREATE UNIQUE INDEX leumi_ils_account_transactions_conflict_key
      ON accounter_schema.leumi_ils_account_transactions (owner_id, account_number, fitid, amount, running_balance);

    CREATE INDEX leumi_ils_account_transactions_owner_id_idx
      ON accounter_schema.leumi_ils_account_transactions (owner_id);

    CREATE INDEX leumi_ils_account_transactions_date_idx
      ON accounter_schema.leumi_ils_account_transactions (date);


    -- ── Foreign-currency accounts ─────────────────────────────────────────────

    CREATE TABLE accounter_schema.leumi_foreign_account_transactions (
      id              UUID    NOT NULL DEFAULT uuidv7() PRIMARY KEY,
      owner_id        UUID    NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,

      -- each currency is its own account at Leumi, with its own number
      account_number  TEXT    NOT NULL,
      currency        TEXT    NOT NULL,

      date            DATE    NOT NULL,
      description     TEXT    NOT NULL,
      reference       TEXT    NOT NULL,
      debit           NUMERIC NOT NULL,
      credit          NUMERIC NOT NULL,
      balance         NUMERIC NOT NULL
    );

    ALTER TABLE accounter_schema.leumi_foreign_account_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.leumi_foreign_account_transactions FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.leumi_foreign_account_transactions
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    CREATE UNIQUE INDEX leumi_foreign_account_transactions_conflict_key
      ON accounter_schema.leumi_foreign_account_transactions
      (owner_id, account_number, date, reference, description, debit, credit, balance);

    CREATE INDEX leumi_foreign_account_transactions_owner_id_idx
      ON accounter_schema.leumi_foreign_account_transactions (owner_id);

    CREATE INDEX leumi_foreign_account_transactions_date_idx
      ON accounter_schema.leumi_foreign_account_transactions (date);


    -- ── Credit cards ──────────────────────────────────────────────────────────

    CREATE TABLE accounter_schema.leumi_creditcard_transactions (
      id                      UUID    NOT NULL DEFAULT uuidv7() PRIMARY KEY,
      owner_id                UUID    NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,

      -- last four digits, as in financial_accounts.account_number
      card_last4              TEXT    NOT NULL,
      -- the account the card is attached to
      related_account_number  TEXT    NOT NULL,

      -- the bank's ID for the transaction; an instalment plan repeats it once per cycle
      card_transaction_id     TEXT    NOT NULL,
      deal_date               DATE    NOT NULL,
      debit_date              DATE    NOT NULL,
      merchant_name           TEXT    NOT NULL,
      deal_description        TEXT    NOT NULL DEFAULT '',
      -- amount of the deal, in its own currency
      deal_amount             NUMERIC NOT NULL,
      -- the bank's code for the deal currency, kept as sent
      deal_currency_code      TEXT    NOT NULL,
      -- amount debited in this cycle; negative for a refund
      charge_amount           NUMERIC NOT NULL,
      charge_currency         TEXT    NOT NULL,
      transaction_type        INTEGER NOT NULL,
      -- which of the cycle's tables the row was listed in
      table_id                INTEGER NOT NULL
    );

    ALTER TABLE accounter_schema.leumi_creditcard_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.leumi_creditcard_transactions FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.leumi_creditcard_transactions
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    CREATE UNIQUE INDEX leumi_creditcard_transactions_conflict_key
      ON accounter_schema.leumi_creditcard_transactions (owner_id, card_last4, card_transaction_id, debit_date);

    CREATE INDEX leumi_creditcard_transactions_owner_id_idx
      ON accounter_schema.leumi_creditcard_transactions (owner_id);

    CREATE INDEX leumi_creditcard_transactions_deal_date_idx
      ON accounter_schema.leumi_creditcard_transactions (deal_date);


    -- ── Raw list ──────────────────────────────────────────────────────────────

    ALTER TABLE accounter_schema.transactions_raw_list
      ADD COLUMN leumi_ils_id UUID
        REFERENCES accounter_schema.leumi_ils_account_transactions ON DELETE CASCADE,
      ADD COLUMN leumi_foreign_id UUID
        REFERENCES accounter_schema.leumi_foreign_account_transactions ON DELETE CASCADE,
      ADD COLUMN leumi_creditcard_id UUID
        REFERENCES accounter_schema.leumi_creditcard_transactions ON DELETE CASCADE;

    CREATE UNIQUE INDEX transactions_raw_list_leumi_ils_id_uindex
      ON accounter_schema.transactions_raw_list (leumi_ils_id)
      WHERE leumi_ils_id IS NOT NULL;

    CREATE UNIQUE INDEX transactions_raw_list_leumi_foreign_id_uindex
      ON accounter_schema.transactions_raw_list (leumi_foreign_id)
      WHERE leumi_foreign_id IS NOT NULL;

    CREATE UNIQUE INDEX transactions_raw_list_leumi_creditcard_id_uindex
      ON accounter_schema.transactions_raw_list (leumi_creditcard_id)
      WHERE leumi_creditcard_id IS NOT NULL;

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
        (leumi_ils_id                    IS NOT NULL)::integer +
        (leumi_foreign_id                IS NOT NULL)::integer +
        (leumi_creditcard_id             IS NOT NULL)::integer = 1
      );


    -- ── Triggers ──────────────────────────────────────────────────────────────

    CREATE OR REPLACE FUNCTION accounter_schema.insert_leumi_ils_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
    BEGIN
        INSERT INTO accounter_schema.transactions_raw_list (leumi_ils_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        SELECT id, owner_id
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number AND type = 'BANK_ACCOUNT'
          AND owner_id = NEW.owner_id;

        IF account_id_var IS NULL THEN
          RAISE EXCEPTION 'No bank account % is set up for this business; add the Leumi account before uploading its transactions', NEW.account_number;
        END IF;

        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        INSERT INTO accounter_schema.transactions (
            owner_id, account_id, charge_id, source_id, source_description, currency,
            event_date, debit_date, amount, current_balance, source_reference, source_origin,
            counter_account, is_fee, origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(NEW.description), ''),
                NULLIF(TRIM(NEW.additional_data), '')
            )), ''),
            'ILS'::accounter_schema.currency,
            NEW.date,
            NEW.effective_date,
            NEW.amount,
            NEW.running_balance,
            NEW.reference_number::TEXT,
            'LEUMI',
            NULL,
            FALSE,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;

    CREATE TRIGGER insert_leumi_ils_transaction
      AFTER INSERT ON accounter_schema.leumi_ils_account_transactions
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_leumi_ils_transaction_handler();


    CREATE OR REPLACE FUNCTION accounter_schema.insert_leumi_foreign_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
    BEGIN
        INSERT INTO accounter_schema.transactions_raw_list (leumi_foreign_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        SELECT id, owner_id
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number AND type = 'BANK_ACCOUNT'
          AND owner_id = NEW.owner_id;

        IF account_id_var IS NULL THEN
          RAISE EXCEPTION 'No bank account % is set up for this business; add the Leumi foreign-currency account before uploading its transactions', NEW.account_number;
        END IF;

        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        INSERT INTO accounter_schema.transactions (
            owner_id, account_id, charge_id, source_id, source_description, currency,
            event_date, debit_date, amount, current_balance, source_reference, source_origin,
            counter_account, is_fee, origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(NEW.description), ''),
            NEW.currency::accounter_schema.currency,
            NEW.date,
            NEW.date,
            CASE WHEN NEW.debit <> 0 THEN NEW.debit * -1 ELSE NEW.credit END,
            NEW.balance,
            NEW.reference,
            'LEUMI',
            NULL,
            FALSE,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;

    CREATE TRIGGER insert_leumi_foreign_transaction
      AFTER INSERT ON accounter_schema.leumi_foreign_account_transactions
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_leumi_foreign_transaction_handler();


    CREATE OR REPLACE FUNCTION accounter_schema.insert_leumi_creditcard_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
    BEGIN
        INSERT INTO accounter_schema.transactions_raw_list (leumi_creditcard_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        SELECT id, owner_id
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.card_last4 AND type = 'CREDIT_CARD'
          AND owner_id = NEW.owner_id;

        IF account_id_var IS NULL THEN
          RAISE EXCEPTION 'No credit card % is set up for this business; add the Leumi card before uploading its transactions', NEW.card_last4;
        END IF;

        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        INSERT INTO accounter_schema.transactions (
            owner_id, account_id, charge_id, source_id, source_description, currency,
            event_date, debit_date, amount, current_balance, source_reference, source_origin,
            counter_account, is_fee, origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(NEW.merchant_name), ''),
                NULLIF(TRIM(NEW.deal_description), '')
            )), ''),
            NEW.charge_currency::accounter_schema.currency,
            NEW.deal_date,
            NEW.debit_date,
            NEW.charge_amount * -1,
            0,
            NEW.card_transaction_id,
            'LEUMI_CREDIT_CARD',
            NULL,
            FALSE,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;

    CREATE TRIGGER insert_leumi_creditcard_transaction
      AFTER INSERT ON accounter_schema.leumi_creditcard_transactions
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_leumi_creditcard_transaction_handler();
  `,
} satisfies MigrationExecutor;
