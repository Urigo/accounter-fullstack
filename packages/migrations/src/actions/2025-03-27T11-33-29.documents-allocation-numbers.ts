import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-03-27T11-33-29.documents-allocation-numbers.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.documents
  add allocation_number varchar(9);
`,
} satisfies MigrationExecutor;
