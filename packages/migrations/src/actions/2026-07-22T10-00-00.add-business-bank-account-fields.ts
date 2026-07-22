import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-07-22T10-00-00.add-business-bank-account-fields.sql',
  run: ({ sql }) => sql`
    -- Keep each business' bank account data (bank number, branch, account) so that
    -- incoming bank transactions can be matched to a local business by their contra
    -- (counterparty) account.
    ALTER TABLE accounter_schema.businesses
      ADD COLUMN IF NOT EXISTS bank_account_bank_number    INTEGER NULL,
      ADD COLUMN IF NOT EXISTS bank_account_branch_number  INTEGER NULL,
      ADD COLUMN IF NOT EXISTS bank_account_account_number INTEGER NULL;

    -- Index to speed up (and enforce lookup semantics of) matching a contra account
    -- to a business within a given owner scope.
    CREATE INDEX IF NOT EXISTS businesses_bank_account_idx
      ON accounter_schema.businesses (
        owner_id,
        bank_account_bank_number,
        bank_account_branch_number,
        bank_account_account_number
      )
      WHERE bank_account_account_number IS NOT NULL;
  `,
} satisfies MigrationExecutor;
