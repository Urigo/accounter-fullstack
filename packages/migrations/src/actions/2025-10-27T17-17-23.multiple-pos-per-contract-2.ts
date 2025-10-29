import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-27T17-17-23.multiple-pos-per-contract-2.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "accounter_schema"."clients_contracts"
DROP COLUMN
  "purchase_order";
`,
} satisfies MigrationExecutor;
