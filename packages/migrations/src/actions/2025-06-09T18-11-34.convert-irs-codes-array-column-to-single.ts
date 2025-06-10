import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-06-09T18-11-34.convert-irs-codes-array-column-to-single.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.sort_codes
    add if not exists default_irs_code smallint;

update accounter_schema.sort_codes
    set default_irs_code = default_irs_codes[1]
    where default_irs_code is not null and array_length(default_irs_codes, 1) > 0;

alter table accounter_schema.financial_entities
    add if not exists irs_code smallint;

update accounter_schema.financial_entities
    set irs_code = irs_codes[1]
    where irs_codes is not null and array_length(irs_codes, 1) > 0;
`,
} satisfies MigrationExecutor;
