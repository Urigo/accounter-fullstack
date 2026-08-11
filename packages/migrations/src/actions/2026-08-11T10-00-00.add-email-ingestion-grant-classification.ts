import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-11T10-00-00.add-email-ingestion-grant-classification.sql',
  run: ({ sql }) => sql`
    -- Record how the control step classified the incoming email (DIRECT, RELAYED,
    -- FORWARDED, SELF_ISSUED) so the ingest step can act on it directly.
    --
    -- Previously "self-issued" was inferred at ingest from business_id = owner_id.
    -- That conflated two very different situations: a genuine copy of a document
    -- the tenant issued itself, and a supplier invoice forwarded in by a colleague
    -- whose every recoverable address happened to belong to the tenant. The second
    -- was wrongly dropped. A dedicated column removes the ambiguity.
    --
    -- NULL means the grant predates this column (or evidence was too thin to
    -- classify); ingest then falls back to the previous business_id comparison.
    ALTER TABLE accounter_schema.email_ingestion_grants
      ADD COLUMN IF NOT EXISTS classification TEXT;
  `,
} satisfies MigrationExecutor;
