import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-24T13-00-00.update-otsar-hahayal-handlers.sql',
  run: ({ sql }) => sql`
    -- Remove OTSAR_HAHAYAL from financial_account_type enum (it was unused; handlers use BANK_ACCOUNT)
    DO $$
    DECLARE
      r         RECORD;
      all_cols  JSONB;
      all_views JSONB;
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'OTSAR_HAHAYAL'
          AND enumtypid = 'accounter_schema.financial_account_type'::regtype
      ) THEN
        RAISE NOTICE 'OTSAR_HAHAYAL not in financial_account_type enum – skipping';
      ELSE
        DROP TABLE IF EXISTS _revert_otsarh_dep_views;
        CREATE TEMP TABLE _revert_otsarh_dep_views AS
        WITH RECURSIVE dep_chain AS (
          SELECT DISTINCT cls.oid
          FROM   pg_depend    d
          JOIN   pg_attribute a   ON  a.attrelid = d.refobjid
                                  AND a.attnum   = d.refobjsubid
                                  AND a.atttypid = 'accounter_schema.financial_account_type'::regtype
          JOIN   pg_class     cls ON  cls.oid    = d.objid
                                  AND cls.relkind = 'v'
          WHERE  d.deptype      = 'n'
            AND  d.refobjsubid <> 0
          UNION
          SELECT DISTINCT cls.oid
          FROM   pg_depend    d
          JOIN   pg_class     cls ON  cls.oid    = d.objid
                                  AND cls.relkind = 'v'
          WHERE  d.refobjid  = 'accounter_schema.financial_account_type'::regtype
            AND  d.deptype   = 'n'
          UNION
          SELECT cls2.oid
          FROM   dep_chain dc
          JOIN   pg_depend  d2   ON  d2.refobjid  = dc.oid
                                  AND d2.deptype  = 'n'
          JOIN   pg_class   cls2 ON  cls2.oid     = d2.objid
                                  AND cls2.relkind = 'v'
        )
        SELECT dc.oid, n.nspname AS schema_name, cls.relname AS view_name,
               pg_get_viewdef(dc.oid, true) AS view_def
        FROM  dep_chain dc
        JOIN  pg_class     cls ON cls.oid = dc.oid
        JOIN  pg_namespace n   ON n.oid   = cls.relnamespace
        ORDER BY dc.oid;

        SELECT COALESCE(array_to_json(array_agg(
          jsonb_build_object('schema', schema_name, 'name', view_name, 'def', view_def)
          ORDER BY oid
        ))::JSONB, '[]'::JSONB) INTO all_views FROM _revert_otsarh_dep_views;

        SELECT COALESCE(array_to_json(array_agg(
          jsonb_build_object('schema', c.table_schema, 'table', c.table_name,
                             'column', c.column_name, 'default', c.column_default)
        ))::JSONB, '[]'::JSONB) INTO all_cols
        FROM   information_schema.columns c
        JOIN   information_schema.tables  t
               ON  t.table_schema = c.table_schema AND t.table_name = c.table_name
               AND t.table_type = 'BASE TABLE'
        WHERE  c.udt_schema = 'accounter_schema'
          AND  c.udt_name   = 'financial_account_type';

        FOR r IN SELECT value FROM jsonb_array_elements(all_views) WITH ORDINALITY AS t(value, ord) ORDER BY ord DESC
        LOOP
          EXECUTE format('DROP VIEW IF EXISTS %I.%I', r.value->>'schema', r.value->>'name');
        END LOOP;

        FOR r IN SELECT value FROM jsonb_array_elements(all_cols)
        LOOP
          IF (r.value->>'default') IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT',
              r.value->>'schema', r.value->>'table', r.value->>'column');
          END IF;
          EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE text USING %I::text',
            r.value->>'schema', r.value->>'table', r.value->>'column', r.value->>'column');
        END LOOP;

        DROP TYPE accounter_schema.financial_account_type;
        CREATE TYPE accounter_schema.financial_account_type AS ENUM (
          'BANK_ACCOUNT', 'CREDIT_CARD', 'CRYPTO_WALLET', 'FOREIGN_SECURITIES', 'BANK_DEPOSIT_ACCOUNT'
        );

        FOR r IN SELECT value FROM jsonb_array_elements(all_cols)
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN %I TYPE accounter_schema.financial_account_type'
            ' USING %I::accounter_schema.financial_account_type',
            r.value->>'schema', r.value->>'table', r.value->>'column', r.value->>'column'
          );
          IF (r.value->>'default') IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s',
              r.value->>'schema', r.value->>'table', r.value->>'column', r.value->>'default');
          END IF;
        END LOOP;

        FOR r IN SELECT value FROM jsonb_array_elements(all_views)
        LOOP
          EXECUTE format('CREATE VIEW %I.%I AS %s', r.value->>'schema', r.value->>'name', r.value->>'def');
        END LOOP;

        DROP TABLE IF EXISTS _revert_otsarh_dep_views;
      END IF;
    END $$;


    -- Update ILS handler: use BANK_ACCOUNT for account_type and source_origin
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
        WHERE account_number = NEW.account_number::TEXT AND type = 'BANK_ACCOUNT';

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
            NEW.opening_balance,
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


    -- Update foreign handler: use BANK_ACCOUNT for account_type and source_origin
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
        WHERE account_number = NEW.account::TEXT AND type = 'BANK_ACCOUNT';

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


    -- Fix creditcard handler: use CREDIT_CARD for account_type and source_origin
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
        WHERE account_number = NEW.masked_pan::TEXT AND type = 'CREDIT_CARD';

        -- 3. resolve currency
        currency_var := CASE NEW.charge_currency
          WHEN 'שקל חדש'    THEN 'ILS'::accounter_schema.currency
          WHEN 'דולר ארה"ב' THEN 'USD'::accounter_schema.currency
          WHEN 'אירו'        THEN 'EUR'::accounter_schema.currency
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
            0,
            NEW.resource_id::TEXT,
            'CREDIT_CARD',
            NULL,
            FALSE,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;
  `,
} satisfies MigrationExecutor;
