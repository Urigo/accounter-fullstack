import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-11-27T18-45-21.deel-cleanup.sql',
  run: ({ sql }) => sql`
    drop table accounter_schema.deel_documents;

    drop table accounter_schema.deel_employees;
  `,
} satisfies MigrationExecutor;
