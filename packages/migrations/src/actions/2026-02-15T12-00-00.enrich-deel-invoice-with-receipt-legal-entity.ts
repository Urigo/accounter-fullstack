import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-15T12-00-00.enrich-deel-invoice-with-receipt-legal-entity.sql',
  run: ({ sql }) => sql`
    ALTER TABLE "accounter_schema"."deel_invoices"
    ADD COLUMN "recipient_legal_entity_id" UUID;
  `,
} satisfies MigrationExecutor;
