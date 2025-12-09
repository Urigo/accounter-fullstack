import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-12-09T18-28-13.bank-account-iban.sql',
  run: ({ sql }) => sql`
    ALTER TABLE
      "accounter_schema"."financial_bank_accounts"
    ADD COLUMN
      "iban" VARCHAR(34) NULL;
  `,
} satisfies MigrationExecutor;
