import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-05-13T12-28-00.corporate-special-tax-rate.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.corporate_tax_variables
    add original_tax_rate numeric default 23 not null;
`,
} satisfies MigrationExecutor;
