import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-06-30T16-20-19.deel-data-update.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.deel_invoices
    add group_id text;

alter table accounter_schema.deel_invoices
    add contract_type text;
`,
} satisfies MigrationExecutor;
