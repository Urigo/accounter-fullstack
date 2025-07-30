import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-07-30T19-01-04.jpy-rate-fix.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.exchange_rates
    alter column jpy type numeric(7, 6) using jpy::numeric(7, 6);
`,
} satisfies MigrationExecutor;
