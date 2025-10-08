import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-09-19T10-06-24.add-documents-hash.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.documents
    add file_hash text;
`,
} satisfies MigrationExecutor;
