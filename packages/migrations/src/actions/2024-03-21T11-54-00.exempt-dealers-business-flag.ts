import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-03-21T11-54-00.exempt-dealers-business-flag.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.businesses
        add exempt_dealer boolean default false not null;
`,
} satisfies MigrationExecutor;
