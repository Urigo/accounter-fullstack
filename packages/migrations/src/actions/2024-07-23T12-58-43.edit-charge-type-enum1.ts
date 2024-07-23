import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-07-23T12-58-43.edit-charge-type-enum1.sql',
  run: ({ sql }) => sql`
    ALTER TYPE accounter_schema.charge_type ADD VALUE 'FINANCIAL';
`,
} satisfies MigrationExecutor;
