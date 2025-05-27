import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-05-26T12-23-36.convert-irs-code-column-to-array.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.sort_codes
    add if not exists default_irs_codes smallint[];

update accounter_schema.sort_codes
    set default_irs_codes = ARRAY [default_irs_code]
    where default_irs_code is not null;

alter table accounter_schema.financial_entities
    add if not exists irs_codes smallint[];

update accounter_schema.financial_entities
    set irs_codes = ARRAY [irs_code]
    where irs_code is not null;
`,
} satisfies MigrationExecutor;
