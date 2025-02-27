import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-02-26T19-27-56.add-to-context-ledger-lock.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.ledger_records
  add locked boolean default false;
`,
} satisfies MigrationExecutor;
