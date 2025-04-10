import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-04-10T15-44-07.tax-excluded-flag.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.tax_categories
    add tax_excluded boolean default false not null;
`,
} satisfies MigrationExecutor;
