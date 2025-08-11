import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-08-11T11-45-42.clients-contracts-table.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.businesses_green_invoice_match
    rename to clients;

alter table accounter_schema.clients
    add hive_id text;
`,
} satisfies MigrationExecutor;
