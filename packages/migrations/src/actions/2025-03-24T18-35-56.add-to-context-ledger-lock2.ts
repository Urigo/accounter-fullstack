import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-03-24T18-35-56.add-to-context-ledger-lock2.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.user_context
    add ledger_lock date;
`,
} satisfies MigrationExecutor;
