import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-11-09T17-03-45.financial-accounts-name.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  accounter_schema.financial_accounts
ADD COLUMN
  account_name2 TEXT NULL;
`,
} satisfies MigrationExecutor;
