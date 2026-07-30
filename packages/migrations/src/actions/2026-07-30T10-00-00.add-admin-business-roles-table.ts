import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-07-30T10-00-00.add-admin-business-roles-table.sql',
  run: ({ sql }) => sql`
    -- Abstract, per-tenant classification of businesses by the "role" they play
    -- in an admin/user context (data sources + dividend-payment + VAT-excluded).
    -- Replaces the hardcoded, institution-specific columns/UUIDs previously
    -- enumerated inside admin-context.provider.ts (#3612), and lets each tenant
    -- own an arbitrary set of data sources without a schema/code change.
    CREATE TYPE accounter_schema.admin_business_role AS ENUM (
      'BANK_ACCOUNT',
      'CREDIT_CARD',
      'CRYPTO_WALLET',
      'DIVIDEND_PAYMENT',
      'VAT_EXCLUDED'
    );

    CREATE TABLE accounter_schema.admin_business_roles (
      owner_id    UUID                                 NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      business_id UUID                                 NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      role        accounter_schema.admin_business_role NOT NULL,
      created_at  TIMESTAMPTZ                          NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ                          NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, business_id, role)
    );

    -- Primary read pattern: "all business ids of role X for owner Y".
    CREATE INDEX admin_business_roles_owner_role_idx
      ON accounter_schema.admin_business_roles (owner_id, role);

    -- Row Level Security: multi-business read scope (any business in the request's
    -- authorized scope) for reads; single explicit write-target for writes. Mirrors
    -- the pattern established by 2026-05-25T10-00-00.rls-multi-business-scope.
    ALTER TABLE accounter_schema.admin_business_roles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.admin_business_roles
      FOR ALL
      USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    -- Force RLS even for the table owner (superusers still bypass).
    ALTER TABLE accounter_schema.admin_business_roles FORCE ROW LEVEL SECURITY;

    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON accounter_schema.admin_business_roles
      FOR EACH ROW
      EXECUTE FUNCTION accounter_schema.update_general_updated_at();
  `,
} satisfies MigrationExecutor;
