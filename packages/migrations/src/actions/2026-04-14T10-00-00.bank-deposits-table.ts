import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-04-14T10-00-00.bank-deposits-table.sql',
  run: ({ sql }) => sql`
    -- Create designated bank_deposits table
    CREATE TABLE accounter_schema.bank_deposits (
      id         uuid DEFAULT gen_random_uuid() NOT NULL
        CONSTRAINT bank_deposits_pk PRIMARY KEY,
      name       text                           NOT NULL,
      open_date  date,
      close_date date,
      currency   accounter_schema.currency,
      owner_id   uuid                           NOT NULL
        CONSTRAINT bank_deposits_owner_id_fk
          REFERENCES accounter_schema.businesses,
      account_id uuid
        CONSTRAINT bank_deposits_account_id_fk
          REFERENCES accounter_schema.financial_accounts
    );

    CREATE INDEX idx_bank_deposits_owner_id ON accounter_schema.bank_deposits (owner_id);

    -- Add temp UUID column to hold the new FK reference while we migrate
    ALTER TABLE accounter_schema.charges_bank_deposits
      ADD COLUMN new_deposit_id uuid;

    -- Migrate existing text deposit IDs → bank_deposits rows, then update the FK column
    WITH new_deposits AS (
      INSERT INTO accounter_schema.bank_deposits (name, owner_id, account_id)
      SELECT DISTINCT deposit_id, owner_id, account_id
      FROM accounter_schema.charges_bank_deposits
      WHERE deposit_id IS NOT NULL
      RETURNING id, name, owner_id
    )
    UPDATE accounter_schema.charges_bank_deposits AS cbd
    SET new_deposit_id = nd.id
    FROM new_deposits nd
    WHERE cbd.deposit_id = nd.name
      AND cbd.owner_id = nd.owner_id;

    -- Back-fill open_date with the earliest transaction debit_date for each deposit
    UPDATE accounter_schema.bank_deposits bd
    SET open_date = min_dates.min_debit_date
    FROM (
      SELECT cbd.new_deposit_id,
             MIN(t.debit_date) AS min_debit_date
      FROM   accounter_schema.charges_bank_deposits cbd
      INNER JOIN accounter_schema.transactions t
        ON t.charge_id = cbd.id
      WHERE cbd.new_deposit_id IS NOT NULL
        AND t.debit_date IS NOT NULL
      GROUP BY cbd.new_deposit_id
    ) min_dates
    WHERE bd.id = min_dates.new_deposit_id;
  `,
} satisfies MigrationExecutor;
