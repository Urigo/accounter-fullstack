import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-06-22T10-00-00.add-email-ingestion-grant-business-id.sql',
  run: ({ sql }) => sql`
    -- Bind the recognized issuing business to the ingest grant. The control step
    -- resolves the provider business (via suggestion_data.emails) under the
    -- tenant's RLS context and records it here so the ingest step can attribute
    -- documents to it without trusting gateway-supplied input. NULL means no
    -- business was recognized, in which case the gateway applies default
    -- treatment (e.g. the email body as a document).
    ALTER TABLE accounter_schema.email_ingestion_grants
      ADD COLUMN IF NOT EXISTS business_id UUID
        REFERENCES accounter_schema.businesses(id) ON DELETE SET NULL;
  `,
} satisfies MigrationExecutor;
