import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-13T12-00-00.add-provider-credentials-table.sql',
  run: ({ sql }) => sql`
    -- Create enum for supported provider keys
    CREATE TYPE accounter_schema.provider_key AS ENUM ('green_invoice', 'deel');

    -- Create table to store per-tenant, encrypted provider credentials
    CREATE TABLE accounter_schema.provider_credentials (
      owner_id   UUID                          NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      provider   accounter_schema.provider_key NOT NULL,
      payload    TEXT                          NOT NULL, -- AES-256-GCM encrypted blob
      created_at TIMESTAMPTZ                   NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ                   NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, provider)
    );

    -- Enable Row Level Security
    ALTER TABLE accounter_schema.provider_credentials ENABLE ROW LEVEL SECURITY;

    -- Tenant isolation policy: each tenant can only access their own rows
    CREATE POLICY tenant_isolation ON accounter_schema.provider_credentials
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    -- Force RLS even for the table owner (superusers bypass by default)
    ALTER TABLE accounter_schema.provider_credentials FORCE ROW LEVEL SECURITY;

    -- Automatically update updated_at on every row update
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON accounter_schema.provider_credentials
      FOR EACH ROW
      EXECUTE FUNCTION accounter_schema.update_general_updated_at();
  `,
} satisfies MigrationExecutor;
