import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-01-21T12-17-15.enrich-charges-types.sql',
  run: ({ sql }) => sql`
  ALTER TYPE accounter_schema.charge_type ADD VALUE IF NOT EXISTS 'BUSINESS_TRIP';
  ALTER TYPE accounter_schema.charge_type ADD VALUE IF NOT EXISTS 'COMMON';
  ALTER TYPE accounter_schema.charge_type ADD VALUE IF NOT EXISTS 'CREDITCARD_BANK';
  ALTER TYPE accounter_schema.charge_type ADD VALUE IF NOT EXISTS 'DIVIDEND';
  ALTER TYPE accounter_schema.charge_type ADD VALUE IF NOT EXISTS 'FOREIGN_SECURITIES';
  ALTER TYPE accounter_schema.charge_type ADD VALUE IF NOT EXISTS 'INTERNAL';
  ALTER TYPE accounter_schema.charge_type ADD VALUE IF NOT EXISTS 'VAT';
`,
} satisfies MigrationExecutor;
