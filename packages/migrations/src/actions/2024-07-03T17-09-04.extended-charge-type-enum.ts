import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-07-03T17-09-04.extended-charge-type-enum.sql',
  run: ({ sql }) => sql`
  ALTER TYPE accounter_schema.charge_type ADD VALUE 'REVALUATION';
`,
} satisfies MigrationExecutor;
