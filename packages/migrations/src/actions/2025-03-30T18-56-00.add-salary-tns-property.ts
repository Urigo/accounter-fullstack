import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-03-30T18-56-00.add-salary-tns-property.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.salaries
  add travel_and_subsistence numeric(9, 2);
`,
} satisfies MigrationExecutor;
