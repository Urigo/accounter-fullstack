import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-29T17-39-47.update-deel-invoices-amounts.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "accounter_schema"."deel_invoices"
ALTER COLUMN
  "others"
TYPE
  numeric(11, 2);
`,
} satisfies MigrationExecutor;
