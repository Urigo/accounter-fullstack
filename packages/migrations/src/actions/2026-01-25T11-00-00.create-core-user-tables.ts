import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-01-25T11-00-00.create-core-user-tables.sql',
  run: ({ sql }) => sql`
    -- Migration: Create Core User Authentication Tables for Auth0 Integration
    -- 
    -- This migration creates the foundational tables for the new Auth0-integrated
    -- authentication system. Auth0 manages user credentials, email verification,
    -- and session tokens. We only store the business-to-user mapping locally.
    --
    -- Key Design Decisions:
    -- 1. user_id is generated when invitation is created (pre-registration)
    -- 2. auth0_user_id is populated after user completes Auth0 password setup and first login
    -- 3. business_users has composite primary key (user_id, business_id) to support M:N relationships
    -- 4. Permissions tables are created for future use but not initially enforced (role-based auth only)

    -- ========================================================================
    -- TABLE: roles
    -- ========================================================================
    -- Defines the available roles in the system.
    -- Roles determine base permissions for users and API keys.

    CREATE TABLE accounter_schema.roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE accounter_schema.roles IS 'Available roles in the system (e.g., business_owner, accountant, employee, scraper)';
    COMMENT ON COLUMN accounter_schema.roles.id IS 'Role identifier (slug format, e.g., ''business_owner'')';
    COMMENT ON COLUMN accounter_schema.roles.name IS 'Display name for the role (e.g., ''Business Owner'')';

    -- ========================================================================
    -- TABLE: permissions
    -- ========================================================================
    -- Defines the available permissions in the system.
    -- NOT ENFORCED INITIALLY - prepared for future granular permission system.
    -- Current implementation uses role-based authorization only.

    CREATE TABLE accounter_schema.permissions (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE accounter_schema.permissions IS 'Available permissions in the system (future use - not initially enforced)';
    COMMENT ON COLUMN accounter_schema.permissions.id IS 'Permission identifier (slug format, e.g., ''manage:users'')';
    COMMENT ON COLUMN accounter_schema.permissions.name IS 'Display name for the permission (e.g., ''Manage Users'')';

    -- ========================================================================
    -- TABLE: role_permissions
    -- ========================================================================
    -- Maps permissions to roles to define default permission sets.
    -- NOT ENFORCED INITIALLY - prepared for future granular permission system.

    CREATE TABLE accounter_schema.role_permissions (
      role_id TEXT NOT NULL REFERENCES accounter_schema.roles(id) ON DELETE CASCADE,
      permission_id TEXT NOT NULL REFERENCES accounter_schema.permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    COMMENT ON TABLE accounter_schema.role_permissions IS 'Maps permissions to roles (future use - not initially enforced)';

    -- ========================================================================
    -- TABLE: business_users
    -- ========================================================================
    -- Links Auth0 users to businesses and roles.
    -- This is the core mapping table that connects external Auth0 identities
    -- to local business access control.

    CREATE TABLE accounter_schema.business_users (
      user_id UUID NOT NULL DEFAULT gen_random_uuid(),
      auth0_user_id TEXT,
      business_id UUID NOT NULL REFERENCES accounter_schema.businesses_admin(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES accounter_schema.roles(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, business_id)
    );

    COMMENT ON TABLE accounter_schema.business_users IS 'Links Auth0 users to businesses with assigned roles (supports M:N relationships)';
    COMMENT ON COLUMN accounter_schema.business_users.user_id IS 'Local user identifier, generated when invitation is created';
    COMMENT ON COLUMN accounter_schema.business_users.auth0_user_id IS 'Auth0 user identifier (e.g., ''auth0|507f1f77bcf86cd799439011''), populated after first login';
    COMMENT ON COLUMN accounter_schema.business_users.business_id IS 'Business this user belongs to';
    COMMENT ON COLUMN accounter_schema.business_users.role_id IS 'Role assigned to this user within this business';

    -- Create indexes for efficient lookups
    CREATE INDEX idx_business_users_auth0_user_id ON accounter_schema.business_users(auth0_user_id) WHERE auth0_user_id IS NOT NULL;
    CREATE INDEX idx_business_users_business_id ON accounter_schema.business_users(business_id);

    -- Create trigger to auto-update updated_at timestamp
    CREATE OR REPLACE FUNCTION accounter_schema.set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER business_users_updated_at
      BEFORE UPDATE ON accounter_schema.business_users
      FOR EACH ROW
      EXECUTE FUNCTION accounter_schema.set_updated_at();

    -- ========================================================================
    -- ENUM: grant_type_enum
    -- ========================================================================
    -- Used for permission overrides (future use).

    CREATE TYPE accounter_schema.grant_type_enum AS ENUM ('grant', 'revoke');

    -- ========================================================================
    -- TABLE: user_permission_overrides
    -- ========================================================================
    -- Stores user-specific permission grants/revokes.
    -- NOT ENFORCED INITIALLY - prepared for future granular permission system.

    CREATE TABLE accounter_schema.user_permission_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      business_id UUID NOT NULL,
      permission_id TEXT NOT NULL REFERENCES accounter_schema.permissions(id) ON DELETE CASCADE,
      grant_type accounter_schema.grant_type_enum NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id, business_id) REFERENCES accounter_schema.business_users(user_id, business_id) ON DELETE CASCADE,
      UNIQUE (user_id, business_id, permission_id)
    );

    COMMENT ON TABLE accounter_schema.user_permission_overrides IS 'User-specific permission overrides (future use - not initially enforced)';

    -- ========================================================================
    -- SEED DATA: Roles
    -- ========================================================================

    INSERT INTO accounter_schema.roles (id, name, description) VALUES
      ('business_owner', 'Business Owner', 'Full access to all features including user management'),
      ('accountant', 'Accountant', 'Can view reports and issue documents'),
      ('employee', 'Employee', 'Limited access to view reports only'),
      ('scraper', 'Scraper', 'Automated role for inserting transactions via API keys');

    -- ========================================================================
    -- SEED DATA: Permissions
    -- ========================================================================
    -- These are defined but NOT enforced initially (role-based auth only).
    -- Authorization code checks role_id, not individual permissions.

    INSERT INTO accounter_schema.permissions (id, name, description) VALUES
      ('manage:users', 'Manage Users', 'Create, update, and delete user accounts and invitations'),
      ('view:payroll', 'View Payroll', 'Access payroll information and reports'),
      ('issue:docs', 'Issue Documents', 'Create and manage invoices, receipts, and other documents'),
      ('insert:transactions', 'Insert Transactions', 'Add new financial transactions');

    -- ========================================================================
    -- SEED DATA: Role Permissions
    -- ========================================================================
    -- Default permission sets for each role (future use - not initially enforced).

    INSERT INTO accounter_schema.role_permissions (role_id, permission_id) VALUES
      -- Business Owner: all permissions
      ('business_owner', 'manage:users'),
      ('business_owner', 'view:payroll'),
      ('business_owner', 'issue:docs'),
      ('business_owner', 'insert:transactions'),
      
      -- Accountant: reports and documents
      ('accountant', 'view:payroll'),
      
      -- Scraper: insert transactions only
      ('scraper', 'insert:transactions');

    COMMENT ON TABLE accounter_schema.role_permissions IS 'Default permission sets for roles (future use - not initially enforced)';
  `,
} satisfies MigrationExecutor;
