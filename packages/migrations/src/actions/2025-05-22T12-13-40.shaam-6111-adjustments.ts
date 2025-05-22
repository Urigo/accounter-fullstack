import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-05-22T12-13-40.shaam-6111-adjustments.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.sort_codes
    add if not exists default_irs_code smallint;

alter table accounter_schema.financial_entities
    add if not exists irs_code smallint;

alter table accounter_schema.sort_codes
    alter column name set not null;
`,
} satisfies MigrationExecutor;
