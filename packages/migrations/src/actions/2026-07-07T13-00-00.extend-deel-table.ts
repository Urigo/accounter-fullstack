import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-07-07T13-00-00.extend-deel-table.sql',
  run: ({ sql }) => sql`
    ALTER TABLE "accounter_schema"."deel_invoices"
    ADD COLUMN "billing_type" VARCHAR(20) NULL,
    ADD COLUMN "document_type" VARCHAR(20) NULL;
  `,
} satisfies MigrationExecutor;
