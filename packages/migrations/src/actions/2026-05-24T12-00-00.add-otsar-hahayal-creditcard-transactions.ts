import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-24T12-00-00.add-otsar-hahayal-creditcard-transactions.sql',
  run: ({ sql }) => sql`
    CREATE TABLE accounter_schema.otsar_hahayal_creditcard_transactions (
      id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_id      UUID        REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,

      -- card identity (from CreditCardsResponse / CreditCard)
      resource_id   UUID        NOT NULL,
      masked_pan    TEXT        NOT NULL,
      card_type     INTEGER     NOT NULL,

      -- billing period group (from creditCardBillingPeriodSchema key)
      billing_period TEXT       NOT NULL,

      -- creditCardTransactionSchema fields
      date          DATE        NOT NULL,
      charge_date   DATE        NOT NULL,
      name          TEXT        NOT NULL,
      deal_amount   NUMERIC     NOT NULL,
      charge_amount NUMERIC     NOT NULL,
      notes         TEXT        NOT NULL DEFAULT '',
      wallet_type   INTEGER     NOT NULL,
      charge_currency TEXT      NOT NULL,
      deal_currency TEXT        NOT NULL,
      counter       INTEGER     NOT NULL DEFAULT 0
    );

    ALTER TABLE accounter_schema.otsar_hahayal_creditcard_transactions
      ENABLE ROW LEVEL SECURITY;

    ALTER TABLE accounter_schema.otsar_hahayal_creditcard_transactions
      FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.otsar_hahayal_creditcard_transactions
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    CREATE UNIQUE INDEX otsar_hahayal_creditcard_transactions_conflict_key
      ON accounter_schema.otsar_hahayal_creditcard_transactions
      (resource_id, card_type, date, charge_date, deal_amount, deal_currency, name, notes, counter);

    CREATE INDEX otsar_hahayal_creditcard_transactions_owner_id_idx
      ON accounter_schema.otsar_hahayal_creditcard_transactions (owner_id);

    CREATE INDEX otsar_hahayal_creditcard_transactions_date_idx
      ON accounter_schema.otsar_hahayal_creditcard_transactions (date);


    -- Add raw-list column
    ALTER TABLE accounter_schema.transactions_raw_list
      ADD COLUMN otsar_hahayal_creditcard_id UUID
        REFERENCES accounter_schema.otsar_hahayal_creditcard_transactions ON DELETE CASCADE;

    CREATE UNIQUE INDEX transactions_raw_list_otsar_hahayal_creditcard_id_uindex
      ON accounter_schema.transactions_raw_list (otsar_hahayal_creditcard_id)
      WHERE otsar_hahayal_creditcard_id IS NOT NULL;

    -- Update the exactly-one-source check constraint to include the new column
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
        (otsar_hahayal_creditcard_id     IS NOT NULL)::integer = 1
      );


    -- Insert trigger function
    CREATE OR REPLACE FUNCTION accounter_schema.insert_otsar_hahayal_creditcard_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
        currency_var   accounter_schema.currency;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_creditcard_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner (credit card account keyed by resource_id)
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.resource_id::TEXT AND account_type = 'OTSAR_HAHAYAL';

        -- 3. resolve currency
        currency_var := CASE NEW.charge_currency
          WHEN 'שקל חדש'   THEN 'ILS'::accounter_schema.currency
          WHEN 'דולר ארה"ב' THEN 'USD'::accounter_schema.currency
          WHEN 'אירו'       THEN 'EUR'::accounter_schema.currency
          ELSE NULL
        END;
        IF currency_var IS NULL THEN
          RAISE EXCEPTION 'Unknown charge_currency: %', NEW.charge_currency;
        END IF;

        -- 4. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        -- 5. transaction
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
                NULLIF(TRIM(NEW.notes), '')
            )), ''),
            currency_var,
            NEW.date,
            NEW.charge_date,
            NEW.charge_amount * -1,
            NULL,
            NEW.resource_id::TEXT,
            'OTSAR_HAHAYAL',
            NULL,
            FALSE,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;

    CREATE TRIGGER insert_otsar_hahayal_creditcard_transaction
      AFTER INSERT ON accounter_schema.otsar_hahayal_creditcard_transactions
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_otsar_hahayal_creditcard_transaction_handler();
  `,
} satisfies MigrationExecutor;
