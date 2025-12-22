import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-12-21T17-04-14.enrich-document-with-description-remarks.sql',
  run: ({ sql }) => sql`
    ALTER TABLE
      "accounter_schema"."documents"
    ADD COLUMN
      "description" TEXT NULL,
    ADD COLUMN
      "remarks" TEXT NULL;

    create trigger update_documents_updated_at
        after update
        on accounter_schema.documents
        for each row
    execute procedure accounter_schema.update_general_updated_at();
  `,
} satisfies MigrationExecutor;
