import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-12-10T10-07-15.business-trips-cleanups.sql',
  run: ({ sql }) => sql`
    drop view accounter_schema.extended_business_trips;
`,
} satisfies MigrationExecutor;
