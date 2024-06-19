import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-06-19T17-41-45.drop-balance-cancellation-limitation.sql',
  run: ({ sql }) => sql`
    drop index accounter_schema.charge_balance_cancellation_id_uindex;
`,
} satisfies MigrationExecutor;
