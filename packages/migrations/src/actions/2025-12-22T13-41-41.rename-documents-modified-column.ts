import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-12-22T13-41-41.rename-documents-modified-column.sql',
  run: ({ sql }) => sql`
    ALTER TABLE
      "accounter_schema"."documents"
    RENAME COLUMN
      "modified_at" TO "updated_at";
  `,
} satisfies MigrationExecutor;
