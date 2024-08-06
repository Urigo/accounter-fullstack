import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-08-06T14-00-00.add-description-to-business-trip-other-transaction.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.business_trips_transactions_other
        rename column expense_type to description;
`,
} satisfies MigrationExecutor;
