import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-11-12T18-21-06.bank-deposits-accounts.sql',
  run: ({ sql }) => sql`
ALTER TYPE accounter_schema.financial_account_type ADD VALUE 'BANK_DEPOSIT_ACCOUNT';
ALTER TYPE accounter_schema.charge_type ADD VALUE 'BANK_DEPOSIT';
`,
} satisfies MigrationExecutor;
