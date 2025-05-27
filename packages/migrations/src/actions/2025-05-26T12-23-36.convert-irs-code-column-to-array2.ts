import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-05-26T12-23-36.convert-irs-code-column-to-array2.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.sort_codes
    drop column default_irs_code;

alter table accounter_schema.financial_entities
    drop column irs_code;
`,
} satisfies MigrationExecutor;
