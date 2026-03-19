import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-19T10-00-00.workspace-settings-and-source-connections.sql',
  run: ({ sql }) => sql`
    -- Workspace-level settings (company profile, branding)
    CREATE TABLE IF NOT EXISTS accounter_schema.workspace_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES accounter_schema.financial_entities(id) UNIQUE,
      company_name TEXT,
      logo_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_settings_owner
      ON accounter_schema.workspace_settings(owner_id);

    -- Source connection provider enum
    DO $$ BEGIN
      CREATE TYPE accounter_schema.source_provider AS ENUM (
        'hapoalim', 'mizrahi', 'discount', 'leumi',
        'isracard', 'amex', 'cal', 'max',
        'cloudinary', 'green_invoice', 'google_drive', 'gmail', 'deel'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    -- Source connection status enum
    DO $$ BEGIN
      CREATE TYPE accounter_schema.source_connection_status AS ENUM (
        'active', 'error', 'disconnected', 'pending'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    -- Source connections (bank accounts, integrations with encrypted credentials)
    CREATE TABLE IF NOT EXISTS accounter_schema.source_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES accounter_schema.financial_entities(id),
      provider accounter_schema.source_provider NOT NULL,
      display_name TEXT NOT NULL,
      account_identifier TEXT,
      status accounter_schema.source_connection_status NOT NULL DEFAULT 'pending',
      credentials_encrypted BYTEA,
      credentials_iv BYTEA,
      credentials_tag BYTEA,
      last_sync_at TIMESTAMPTZ,
      last_sync_error TEXT,
      financial_account_id UUID REFERENCES accounter_schema.financial_accounts(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_id, provider, account_identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_source_connections_owner
      ON accounter_schema.source_connections(owner_id);

    CREATE INDEX IF NOT EXISTS idx_source_connections_provider
      ON accounter_schema.source_connections(owner_id, provider);
  `,
} satisfies MigrationExecutor;
