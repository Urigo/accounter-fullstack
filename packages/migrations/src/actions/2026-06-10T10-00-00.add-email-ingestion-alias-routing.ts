import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-06-10T10-00-00.add-email-ingestion-alias-routing.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.email_ingestion_alias_routing (
      id         UUID        NOT NULL DEFAULT gen_random_uuid(),
      alias      TEXT        NOT NULL,
      owner_id   UUID        NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id)
    );

    -- Normalization strategy: unique active alias lookup is case-insensitive via
    -- functional index on lower(alias). Aliases are stored as-received; the
    -- partial WHERE clause ensures only one active alias per normalized value.
    CREATE UNIQUE INDEX IF NOT EXISTS email_ingestion_alias_routing_alias_active_unique
      ON accounter_schema.email_ingestion_alias_routing (lower(alias))
      WHERE is_active = TRUE;

    -- Index for efficient tenant-scoped queries (all aliases for an owner).
    CREATE INDEX IF NOT EXISTS email_ingestion_alias_routing_owner_id_idx
      ON accounter_schema.email_ingestion_alias_routing (owner_id);

    ALTER TABLE accounter_schema.email_ingestion_alias_routing ENABLE ROW LEVEL SECURITY;

    -- Alias resolution must happen before tenant context is known (that is the
    -- whole point of this lookup), so SELECT is unrestricted for any authenticated
    -- server connection.  Writes remain scoped to the row-owning tenant.
    CREATE POLICY alias_resolution_select ON accounter_schema.email_ingestion_alias_routing
      FOR SELECT
      USING (TRUE);

    CREATE POLICY tenant_isolation_write ON accounter_schema.email_ingestion_alias_routing
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    ALTER TABLE accounter_schema.email_ingestion_alias_routing FORCE ROW LEVEL SECURITY;

    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON accounter_schema.email_ingestion_alias_routing
      FOR EACH ROW
      EXECUTE FUNCTION accounter_schema.update_general_updated_at();
  `,
} satisfies MigrationExecutor;
