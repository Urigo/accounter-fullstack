import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-30T18-57-58.client-integrations.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "accounter_schema"."clients"
ADD COLUMN
  "integrations" JSONB DEFAULT '{}'::JSONB NULL;

UPDATE
  accounter_schema.clients
SET
  integrations['greenInvoiceId'] = to_jsonb(green_invoice_id)
WHERE
  green_invoice_id IS NOT NULL;
`,
} satisfies MigrationExecutor;
