import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-06-10T13-00-00.add-email-ingestion-quarantine.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.email_ingestion_quarantine (
      id               UUID        NOT NULL DEFAULT gen_random_uuid(),
      reason_code      TEXT        NOT NULL,
      tenant_candidate UUID,
      message_id       TEXT,
      raw_message_hash TEXT,
      correlation_id   TEXT        NOT NULL,
      status           TEXT        NOT NULL DEFAULT 'pending',
      retry_count      INTEGER     NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id)
    );

    -- Triage indexes: operators filter quarantined items by reason, status, and date.
    CREATE INDEX IF NOT EXISTS email_ingestion_quarantine_reason_code_idx
      ON accounter_schema.email_ingestion_quarantine (reason_code);

    CREATE INDEX IF NOT EXISTS email_ingestion_quarantine_status_idx
      ON accounter_schema.email_ingestion_quarantine (status);

    CREATE INDEX IF NOT EXISTS email_ingestion_quarantine_created_at_idx
      ON accounter_schema.email_ingestion_quarantine (created_at);

    ALTER TABLE accounter_schema.email_ingestion_quarantine ENABLE ROW LEVEL SECURITY;

    -- Quarantine rows are owned by the tenant they were attributed to (when
    -- known).  tenant_candidate is nullable because alias resolution may have
    -- failed, but RLS still applies: rows with a non-null tenant_candidate are
    -- only accessible to that tenant.
    CREATE POLICY tenant_isolation ON accounter_schema.email_ingestion_quarantine
      FOR ALL
      USING (
        tenant_candidate IS NULL
        OR tenant_candidate = accounter_schema.get_current_business_id()
      )
      WITH CHECK (
        tenant_candidate IS NULL
        OR tenant_candidate = accounter_schema.get_current_business_id()
      );

    ALTER TABLE accounter_schema.email_ingestion_quarantine FORCE ROW LEVEL SECURITY;

    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON accounter_schema.email_ingestion_quarantine
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();
  `,
} satisfies MigrationExecutor;
