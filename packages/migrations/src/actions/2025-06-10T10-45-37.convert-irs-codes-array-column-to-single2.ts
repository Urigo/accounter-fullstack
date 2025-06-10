import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-06-10T10-45-37.convert-irs-codes-array-column-to-single2.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.sort_codes
    drop column default_irs_codes;

alter table accounter_schema.financial_entities
    drop column irs_codes;
`,
} satisfies MigrationExecutor;
