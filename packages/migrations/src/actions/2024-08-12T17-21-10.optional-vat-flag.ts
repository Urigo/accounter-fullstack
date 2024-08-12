import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-08-12T17-21-10.optional-vat-flag.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.businesses
        add optional_vat boolean default false not null;
`,
} satisfies MigrationExecutor;
