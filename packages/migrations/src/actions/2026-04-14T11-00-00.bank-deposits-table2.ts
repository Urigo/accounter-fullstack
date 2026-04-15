import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-04-14T11-00-00.bank-deposits-table2.sql',
  run: ({ sql }) => sql`
    -- Swap columns: drop old text column, rename UUID column into its place
    ALTER TABLE accounter_schema.charges_bank_deposits
      DROP COLUMN deposit_id;

    ALTER TABLE accounter_schema.charges_bank_deposits
      RENAME COLUMN new_deposit_id TO deposit_id;

    -- Add FK constraint and index on the new deposit_id column
    ALTER TABLE accounter_schema.charges_bank_deposits
      ADD CONSTRAINT charges_bank_deposits_deposit_id_fk
        FOREIGN KEY (deposit_id) REFERENCES accounter_schema.bank_deposits (id);

    CREATE INDEX idx_charges_bank_deposits_deposit_id
      ON accounter_schema.charges_bank_deposits (deposit_id);
  `,
} satisfies MigrationExecutor;
