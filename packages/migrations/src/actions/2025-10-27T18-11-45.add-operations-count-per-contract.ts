import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-27T18-11-45.add-operations-count-per-contract.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "accounter_schema"."clients_contracts"
ADD COLUMN
  "operations_count" BIGINT DEFAULT 0 NOT NULL;
`,
} satisfies MigrationExecutor;
