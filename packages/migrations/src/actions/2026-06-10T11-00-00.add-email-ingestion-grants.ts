import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-06-10T11-00-00.add-email-ingestion-grants.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.email_ingestion_grants (
      id               UUID        NOT NULL DEFAULT gen_random_uuid(),
      jti              TEXT        NOT NULL,
      owner_id         UUID        NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      message_id       TEXT        NOT NULL,
      raw_message_hash TEXT        NOT NULL,
      action           TEXT        NOT NULL DEFAULT 'ingest',
      expires_at       TIMESTAMPTZ NOT NULL,
      consumed_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id)
    );

    -- jti must be globally unique: prevents grant replay across all tenants.
    CREATE UNIQUE INDEX IF NOT EXISTS email_ingestion_grants_jti_unique
      ON accounter_schema.email_ingestion_grants (jti);

    -- Index for expiry-based cleanup and active-grant range scans.
    CREATE INDEX IF NOT EXISTS email_ingestion_grants_expires_at_idx
      ON accounter_schema.email_ingestion_grants (expires_at);

    -- Index for tenant-scoped grant lookups.
    CREATE INDEX IF NOT EXISTS email_ingestion_grants_owner_id_idx
      ON accounter_schema.email_ingestion_grants (owner_id);

    ALTER TABLE accounter_schema.email_ingestion_grants ENABLE ROW LEVEL SECURITY;

    -- Tenant isolation: a grant is only visible and writable to the tenant it
    -- was issued for.  Consume-once atomicity is enforced at the application
    -- layer: UPDATE SET consumed_at = NOW() WHERE jti = $1 AND consumed_at IS NULL,
    -- then check that exactly one row was updated.
    CREATE POLICY tenant_isolation ON accounter_schema.email_ingestion_grants
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    ALTER TABLE accounter_schema.email_ingestion_grants FORCE ROW LEVEL SECURITY;
  `,
} satisfies MigrationExecutor;
