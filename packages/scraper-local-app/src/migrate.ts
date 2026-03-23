import type { Pool } from 'pg';

const MIGRATIONS_TABLE = 'accounter_schema.custom_scrapers_migrations';

const migrations: Array<{ name: string; sql: string }> = [
  {
    name: '2026-03-17T00-00-00.bank-mizrahi',
    sql: `
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

      ALTER TABLE accounter_schema.transactions_raw_list
        ADD COLUMN IF NOT EXISTS bank_mizrahi_id uuid;

      DO $$
      BEGIN
        ALTER TABLE accounter_schema.transactions_raw_list
          DROP CONSTRAINT IF EXISTS transactions_raw_list_check;
        ALTER TABLE accounter_schema.transactions_raw_list
          ADD CONSTRAINT transactions_raw_list_check CHECK (
            (creditcard_id IS NOT NULL)::integer +
            (poalim_ils_id IS NOT NULL)::integer +
            (poalim_foreign_id IS NOT NULL)::integer +
            (poalim_swift_id IS NOT NULL)::integer +
            (kraken_id IS NOT NULL)::integer +
            (etana_id IS NOT NULL)::integer +
            (etherscan_id IS NOT NULL)::integer +
            (amex_id IS NOT NULL)::integer +
            (cal_id IS NOT NULL)::integer +
            (bank_discount_id IS NOT NULL)::integer +
            (max_creditcard_id IS NOT NULL)::integer +
            (bank_mizrahi_id IS NOT NULL)::integer = 1
          );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      $$;

      CREATE OR REPLACE FUNCTION accounter_schema.insert_bank_mizrahi_transaction_handler()
        RETURNS trigger LANGUAGE plpgsql AS
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

        SELECT INTO account_id_var, owner_id_var id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number;

        IF (owner_id_var IS NULL) THEN
          RETURN NEW;
        END IF;

        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        INSERT INTO accounter_schema.transactions (
          account_id, charge_id, source_id, source_description, currency,
          event_date, debit_date, amount, current_balance,
          source_reference, source_origin, origin_key, owner_id
        ) VALUES (
          account_id_var, charge_id_var, merged_id, NEW.description,
          COALESCE(NEW.original_currency, 'ILS')::accounter_schema.currency,
          to_date(NEW.date, 'YYYY-MM-DD'),
          to_date(NEW.processed_date, 'YYYY-MM-DD'),
          NEW.charged_amount * -1, 0,
          COALESCE(NEW.transaction_identifier, NEW.id::text),
          'MIZRAHI',
          NEW.id::text,
          owner_id_var
        );
        RETURN NEW;
      END;
      $func$;

      DROP TRIGGER IF EXISTS bank_mizrahi_transaction_insert_trigger
        ON accounter_schema.bank_mizrahi_transactions;
      CREATE TRIGGER bank_mizrahi_transaction_insert_trigger
        AFTER INSERT ON accounter_schema.bank_mizrahi_transactions
        FOR EACH ROW
        EXECUTE FUNCTION accounter_schema.insert_bank_mizrahi_transaction_handler();
    `,
  },
  {
    name: '2026-03-22T00-00-00.fix-trigger-rls-context',
    sql: `
      CREATE OR REPLACE FUNCTION accounter_schema.insert_bank_mizrahi_transaction_handler()
        RETURNS trigger LANGUAGE plpgsql AS
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

        SELECT INTO account_id_var, owner_id_var id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number;

        IF (owner_id_var IS NULL) THEN
          RETURN NEW;
        END IF;

        PERFORM set_config('app.current_business_id', owner_id_var::text, true);

        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        INSERT INTO accounter_schema.transactions (
          account_id, charge_id, source_id, source_description, currency,
          event_date, debit_date, amount, current_balance,
          source_reference, source_origin, origin_key, owner_id
        ) VALUES (
          account_id_var, charge_id_var, merged_id, NEW.description,
          COALESCE(NEW.original_currency, 'ILS')::accounter_schema.currency,
          to_date(NEW.date, 'YYYY-MM-DD'),
          to_date(NEW.processed_date, 'YYYY-MM-DD'),
          NEW.charged_amount * -1, 0,
          COALESCE(NEW.transaction_identifier, NEW.id::text),
          'MIZRAHI',
          NEW.id::text,
          owner_id_var
        );
        RETURN NEW;
      END;
      $func$;

      CREATE OR REPLACE FUNCTION accounter_schema.insert_isracard_alt_transaction_handler()
        RETURNS trigger LANGUAGE plpgsql AS
      $func$
      DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
      BEGIN
        INSERT INTO accounter_schema.transactions_raw_list (isracard_alt_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        SELECT INTO account_id_var, owner_id_var id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number;

        IF (owner_id_var IS NULL) THEN
          RETURN NEW;
        END IF;

        PERFORM set_config('app.current_business_id', owner_id_var::text, true);

        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        INSERT INTO accounter_schema.transactions (
          account_id, charge_id, source_id, source_description, currency,
          event_date, debit_date, amount, current_balance,
          source_reference, source_origin, origin_key, owner_id
        ) VALUES (
          account_id_var, charge_id_var, merged_id, NEW.description,
          COALESCE(NEW.original_currency, 'ILS')::accounter_schema.currency,
          to_date(NEW.date, 'YYYY-MM-DD'),
          to_date(NEW.processed_date, 'YYYY-MM-DD'),
          NEW.charged_amount * -1, 0,
          COALESCE(NEW.transaction_identifier, NEW.id::text),
          'ISRACARD',
          NEW.id::text,
          owner_id_var
        );
        RETURN NEW;
      END;
      $func$;
    `,
  },
  {
    name: '2026-03-17T01-00-00.isracard-alt',
    sql: `
      CREATE TABLE IF NOT EXISTS accounter_schema.isracard_alt_transactions (
        id uuid DEFAULT gen_random_uuid() NOT NULL
          CONSTRAINT isracard_alt_transactions_pk PRIMARY KEY,
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
        CONSTRAINT isracard_alt_transactions_unique UNIQUE (account_number, transaction_identifier)
      );

      ALTER TABLE accounter_schema.transactions_raw_list
        ADD COLUMN IF NOT EXISTS isracard_alt_id uuid;

      DO $$
      BEGIN
        ALTER TABLE accounter_schema.transactions_raw_list
          DROP CONSTRAINT IF EXISTS transactions_raw_list_check;
        ALTER TABLE accounter_schema.transactions_raw_list
          ADD CONSTRAINT transactions_raw_list_check CHECK (
            (creditcard_id IS NOT NULL)::integer +
            (poalim_ils_id IS NOT NULL)::integer +
            (poalim_foreign_id IS NOT NULL)::integer +
            (poalim_swift_id IS NOT NULL)::integer +
            (kraken_id IS NOT NULL)::integer +
            (etana_id IS NOT NULL)::integer +
            (etherscan_id IS NOT NULL)::integer +
            (amex_id IS NOT NULL)::integer +
            (cal_id IS NOT NULL)::integer +
            (bank_discount_id IS NOT NULL)::integer +
            (max_creditcard_id IS NOT NULL)::integer +
            (bank_mizrahi_id IS NOT NULL)::integer +
            (isracard_alt_id IS NOT NULL)::integer = 1
          );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      $$;

      CREATE OR REPLACE FUNCTION accounter_schema.insert_isracard_alt_transaction_handler()
        RETURNS trigger LANGUAGE plpgsql AS
      $func$
      DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
      BEGIN
        INSERT INTO accounter_schema.transactions_raw_list (isracard_alt_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        SELECT INTO account_id_var, owner_id_var id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number;

        IF (owner_id_var IS NULL) THEN
          RETURN NEW;
        END IF;

        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        INSERT INTO accounter_schema.transactions (
          account_id, charge_id, source_id, source_description, currency,
          event_date, debit_date, amount, current_balance,
          source_reference, source_origin, origin_key, owner_id
        ) VALUES (
          account_id_var, charge_id_var, merged_id, NEW.description,
          COALESCE(NEW.original_currency, 'ILS')::accounter_schema.currency,
          to_date(NEW.date, 'YYYY-MM-DD'),
          to_date(NEW.processed_date, 'YYYY-MM-DD'),
          NEW.charged_amount * -1, 0,
          COALESCE(NEW.transaction_identifier, NEW.id::text),
          'ISRACARD',
          NEW.id::text,
          owner_id_var
        );
        RETURN NEW;
      END;
      $func$;

      DROP TRIGGER IF EXISTS isracard_alt_transaction_insert_trigger
        ON accounter_schema.isracard_alt_transactions;
      CREATE TRIGGER isracard_alt_transaction_insert_trigger
        AFTER INSERT ON accounter_schema.isracard_alt_transactions
        FOR EACH ROW
        EXECUTE FUNCTION accounter_schema.insert_isracard_alt_transaction_handler();
    `,
  },
];

export async function runCustomMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      name VARCHAR(255) PRIMARY KEY,
      run_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const { rows: ran } = await pool.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE}`,
  );
  const ranNames = new Set(ran.map(r => r.name));

  for (const migration of migrations) {
    if (ranNames.has(migration.name)) {
      continue;
    }
    console.log(`Running migration: ${migration.name}`);
    await pool.query(migration.sql);
    await pool.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [migration.name]);
    console.log(`Migration complete: ${migration.name}`);
  }
}
