import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-06-11T10-00-00.add-email-ingestion-idempotency.sql',
  run: ({ sql }) => sql`
    -- Idempotency keys: a gateway-supplied key is persisted with its outcome so that
    -- retries with the same key return the prior result without re-processing.
    CREATE TABLE IF NOT EXISTS accounter_schema.email_ingestion_idempotency_keys (
      id               UUID        NOT NULL DEFAULT gen_random_uuid(),
      idempotency_key  TEXT        NOT NULL,
      owner_id         UUID        NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      outcome          TEXT        NOT NULL,
      ingest_id        UUID,
      audit_id         TEXT        NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id)
    );

    -- Tenant-scoped uniqueness: the same key from different tenants is a different operation.
    CREATE UNIQUE INDEX IF NOT EXISTS email_ingestion_idempotency_keys_key_tenant_unique
      ON accounter_schema.email_ingestion_idempotency_keys (idempotency_key, owner_id);

    CREATE INDEX IF NOT EXISTS email_ingestion_idempotency_keys_created_at_idx
      ON accounter_schema.email_ingestion_idempotency_keys (created_at);

    ALTER TABLE accounter_schema.email_ingestion_idempotency_keys ENABLE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.email_ingestion_idempotency_keys
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    ALTER TABLE accounter_schema.email_ingestion_idempotency_keys FORCE ROW LEVEL SECURITY;

    -- Dedup fingerprints: a server-computed hash of tenant + message fingerprint is persisted
    -- so duplicate deliveries (same raw message, same tenant) are detected and short-circuited
    -- even when the gateway supplies a different idempotency key.
    CREATE TABLE IF NOT EXISTS accounter_schema.email_ingestion_dedup_fingerprints (
      id             UUID        NOT NULL DEFAULT gen_random_uuid(),
      owner_id       UUID        NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      fingerprint    TEXT        NOT NULL,
      outcome        TEXT        NOT NULL,
      ingest_id      UUID,
      correlation_id TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id)
    );

    -- Tenant-scoped dedup: the same fingerprint for different tenants is a different message.
    CREATE UNIQUE INDEX IF NOT EXISTS email_ingestion_dedup_fingerprints_owner_fp_unique
      ON accounter_schema.email_ingestion_dedup_fingerprints (owner_id, fingerprint);

    CREATE INDEX IF NOT EXISTS email_ingestion_dedup_fingerprints_created_at_idx
      ON accounter_schema.email_ingestion_dedup_fingerprints (created_at);

    ALTER TABLE accounter_schema.email_ingestion_dedup_fingerprints ENABLE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.email_ingestion_dedup_fingerprints
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    ALTER TABLE accounter_schema.email_ingestion_dedup_fingerprints FORCE ROW LEVEL SECURITY;
  `,
} satisfies MigrationExecutor;
