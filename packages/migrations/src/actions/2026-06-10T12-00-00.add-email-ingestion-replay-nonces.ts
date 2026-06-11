import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-06-10T12-00-00.add-email-ingestion-replay-nonces.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.email_ingestion_replay_nonces (
      id         UUID        NOT NULL DEFAULT gen_random_uuid(),
      nonce      TEXT        NOT NULL,
      owner_id   UUID        REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id)
    );

    -- Globally unique nonce within the active window: prevents replay attacks
    -- across all tenants. A nonce is valid until expires_at; after that it can
    -- be pruned by a background job.
    CREATE UNIQUE INDEX IF NOT EXISTS email_ingestion_replay_nonces_nonce_unique
      ON accounter_schema.email_ingestion_replay_nonces (nonce);

    -- Index for expiry-based cleanup of expired nonces.
    CREATE INDEX IF NOT EXISTS email_ingestion_replay_nonces_expires_at_idx
      ON accounter_schema.email_ingestion_replay_nonces (expires_at);

    ALTER TABLE accounter_schema.email_ingestion_replay_nonces ENABLE ROW LEVEL SECURITY;

    -- Nonce lookup must work before the tenant is known (replay check happens
    -- at the gateway before alias resolution).  Allow unrestricted SELECTs so
    -- the check can be performed without a tenant context.
    CREATE POLICY replay_nonce_select ON accounter_schema.email_ingestion_replay_nonces
      FOR SELECT USING (TRUE);

    -- Writes are always tenant-scoped: the owner is known by the time the nonce
    -- is recorded after a successful ingest.
    CREATE POLICY tenant_isolation_write ON accounter_schema.email_ingestion_replay_nonces
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    ALTER TABLE accounter_schema.email_ingestion_replay_nonces FORCE ROW LEVEL SECURITY;
  `,
} satisfies MigrationExecutor;
