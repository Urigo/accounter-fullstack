import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-04-13T10-00-00.add-business-dates-to-user-context.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.user_context
    add column if not exists date_established date;

alter table accounter_schema.user_context
    add column if not exists initial_accounter_year smallint;
`,
} satisfies MigrationExecutor;
