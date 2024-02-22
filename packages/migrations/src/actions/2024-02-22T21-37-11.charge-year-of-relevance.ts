import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-02-22T21-37-11.charge-year-of-relevance.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.charges
    add year_of_relevance date;
`,
} satisfies MigrationExecutor;
