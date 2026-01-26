import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-01-26T12-00-00.create-invitations-apikeys-audit-tables.sql',
  run: ({ sql }) => sql`
    -- Migration: Create Invitations, API Keys, and Audit Logs Tables
    -- 
    -- This migration creates tables for:
    -- 1. Invitation management (Auth0 pre-registration flow)
    -- 2. API key authentication (independent of Auth0 for automated processes)
    -- 3. Audit logging (security and compliance monitoring)
    --
    -- Key Design Decisions:
    -- 1. Invitations trigger Auth0 Management API calls to create blocked users
    -- 2. Auth0 user is unblocked only after user sets password and accepts invitation
    -- 3. API keys provide authentication independent of Auth0 for automated processes
    -- 4. API keys use SHA-256 hashed storage for security
    -- 5. Audit logs preserve records even after user/business deletion (ON DELETE SET NULL)

    -- ========================================================================
    -- TABLE: invitations
    -- ========================================================================
    -- Stores pending user invitations for Auth0 pre-registration flow.
    -- Flow: invitation created → Auth0 user created (blocked) → user sets password
    --       → accepts invitation → Auth0 user unblocked

    CREATE TABLE accounter_schema.invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role_id TEXT NOT NULL REFERENCES accounter_schema.roles(id) ON DELETE RESTRICT,
      token TEXT UNIQUE NOT NULL,
      auth0_user_created BOOLEAN NOT NULL DEFAULT FALSE,
      auth0_user_id TEXT,
      invited_by_user_id UUID,
      accepted_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE accounter_schema.invitations IS 'Pre-registration flow: invitation created → Auth0 user created (blocked) → user sets password → accepts invitation → Auth0 user unblocked';
    COMMENT ON COLUMN accounter_schema.invitations.id IS 'Unique invitation identifier';
    COMMENT ON COLUMN accounter_schema.invitations.business_id IS 'Business the user is being invited to';
    COMMENT ON COLUMN accounter_schema.invitations.email IS 'Email address of the invited user';
    COMMENT ON COLUMN accounter_schema.invitations.role_id IS 'Role to assign to the user upon acceptance';
    COMMENT ON COLUMN accounter_schema.invitations.token IS 'Cryptographically secure 64-character random string for invitation URL';
    COMMENT ON COLUMN accounter_schema.invitations.auth0_user_created IS 'Tracks whether Auth0 Management API call succeeded';
    COMMENT ON COLUMN accounter_schema.invitations.auth0_user_id IS 'Auth0 user ID from pre-registration (e.g., ''auth0|507f1f77bcf86cd799439011''), used for cleanup';
    COMMENT ON COLUMN accounter_schema.invitations.invited_by_user_id IS 'User ID of the admin who created this invitation';
    COMMENT ON COLUMN accounter_schema.invitations.accepted_at IS 'Timestamp when invitation was accepted (NULL until accepted, single-use token tracking)';
    COMMENT ON COLUMN accounter_schema.invitations.expires_at IS 'Invitation expiration timestamp (typically 7 days from creation)';
    COMMENT ON COLUMN accounter_schema.invitations.created_at IS 'Timestamp when invitation was created';

    -- Create foreign key constraint for invited_by_user_id
    -- Note: References the first part of business_users composite primary key
    ALTER TABLE accounter_schema.invitations
      ADD CONSTRAINT invitations_invited_by_user_id_fkey
      FOREIGN KEY (invited_by_user_id)
      REFERENCES accounter_schema.business_users(user_id)
      ON DELETE SET NULL;

    -- Create indexes for efficient lookups and cleanup queries
    CREATE INDEX idx_invitations_business_id ON accounter_schema.invitations(business_id);
    CREATE INDEX idx_invitations_expires_at ON accounter_schema.invitations(expires_at);
    CREATE INDEX idx_invitations_email ON accounter_schema.invitations(email);

    -- ========================================================================
    -- TABLE: api_keys
    -- ========================================================================
    -- Stores API keys for programmatic access independent of Auth0.
    -- Used for automated processes like scrapers that need long-lived credentials.

    CREATE TABLE accounter_schema.api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES accounter_schema.roles(id) ON DELETE RESTRICT,
      key_hash TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT api_keys_revoked_at_check CHECK (revoked_at IS NULL OR revoked_at > created_at)
    );

    COMMENT ON TABLE accounter_schema.api_keys IS 'API keys are independent of Auth0, used for programmatic access (e.g., scraper role)';
    COMMENT ON COLUMN accounter_schema.api_keys.id IS 'Unique API key identifier';
    COMMENT ON COLUMN accounter_schema.api_keys.business_id IS 'Business this API key belongs to';
    COMMENT ON COLUMN accounter_schema.api_keys.role_id IS 'Role assigned to this API key (e.g., ''scraper'')';
    COMMENT ON COLUMN accounter_schema.api_keys.key_hash IS 'SHA-256 hash of the API key (never store plaintext keys)';
    COMMENT ON COLUMN accounter_schema.api_keys.name IS 'Descriptive name for this API key (e.g., ''Production Scraper'')';
    COMMENT ON COLUMN accounter_schema.api_keys.last_used_at IS 'Timestamp of last API key usage (updated hourly to prevent write amplification)';
    COMMENT ON COLUMN accounter_schema.api_keys.revoked_at IS 'Timestamp when API key was revoked (NULL if active)';
    COMMENT ON COLUMN accounter_schema.api_keys.created_at IS 'Timestamp when API key was created';

    -- Create indexes for efficient lookups
    CREATE INDEX idx_api_keys_business_id ON accounter_schema.api_keys(business_id);
    CREATE INDEX idx_api_keys_key_hash ON accounter_schema.api_keys(key_hash);

    -- ========================================================================
    -- TABLE: api_key_permission_overrides
    -- ========================================================================
    -- Stores API-key-specific permission grants/revokes.
    -- NOT ENFORCED INITIALLY - prepared for future granular permission system.

    CREATE TABLE accounter_schema.api_key_permission_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_key_id UUID NOT NULL REFERENCES accounter_schema.api_keys(id) ON DELETE CASCADE,
      permission_id TEXT NOT NULL REFERENCES accounter_schema.permissions(id) ON DELETE CASCADE,
      grant_type accounter_schema.grant_type_enum NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (api_key_id, permission_id)
    );

    COMMENT ON TABLE accounter_schema.api_key_permission_overrides IS 'API-key-specific permission overrides (future use - not initially enforced)';
    COMMENT ON COLUMN accounter_schema.api_key_permission_overrides.id IS 'Unique override identifier';
    COMMENT ON COLUMN accounter_schema.api_key_permission_overrides.api_key_id IS 'API key this override applies to';
    COMMENT ON COLUMN accounter_schema.api_key_permission_overrides.permission_id IS 'Permission being granted or revoked';
    COMMENT ON COLUMN accounter_schema.api_key_permission_overrides.grant_type IS 'Whether this is a grant or revoke override';

    -- ========================================================================
    -- TABLE: audit_logs
    -- ========================================================================
    -- Stores a trail of critical actions for security and compliance monitoring.
    -- Records user actions, system events, and security-relevant operations.

    CREATE TABLE accounter_schema.audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID REFERENCES accounter_schema.businesses(id) ON DELETE SET NULL,
      user_id UUID,
      auth0_user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details JSONB,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE accounter_schema.audit_logs IS 'Audit trail for critical security and business actions (e.g., login, user creation, sensitive data access)';
    COMMENT ON COLUMN accounter_schema.audit_logs.id IS 'Unique audit log entry identifier';
    COMMENT ON COLUMN accounter_schema.audit_logs.business_id IS 'Business associated with this action (NULL for system-wide actions or failed logins)';
    COMMENT ON COLUMN accounter_schema.audit_logs.user_id IS 'Local user identifier (from business_users table) who performed the action';
    COMMENT ON COLUMN accounter_schema.audit_logs.auth0_user_id IS 'Auth0 user identifier for audit trail (e.g., ''auth0|507f1f77bcf86cd799439011'')';
    COMMENT ON COLUMN accounter_schema.audit_logs.action IS 'Action type (e.g., ''USER_LOGIN'', ''INVOICE_UPDATE'', ''PERMISSION_CHANGE'')';
    COMMENT ON COLUMN accounter_schema.audit_logs.entity IS 'Entity type affected by the action (e.g., ''Invoice'', ''User'', ''Document'')';
    COMMENT ON COLUMN accounter_schema.audit_logs.entity_id IS 'Identifier of the affected entity';
    COMMENT ON COLUMN accounter_schema.audit_logs.details IS 'Additional action metadata (e.g., before/after state, error details)';
    COMMENT ON COLUMN accounter_schema.audit_logs.ip_address IS 'IP address of the client that initiated the action';
    COMMENT ON COLUMN accounter_schema.audit_logs.created_at IS 'Timestamp when the action occurred';

    -- Create indexes for efficient audit log queries
    CREATE INDEX idx_audit_logs_business_id_created_at ON accounter_schema.audit_logs(business_id, created_at DESC);
    CREATE INDEX idx_audit_logs_user_id ON accounter_schema.audit_logs(user_id);
    CREATE INDEX idx_audit_logs_action ON accounter_schema.audit_logs(action);
    CREATE INDEX idx_audit_logs_created_at ON accounter_schema.audit_logs(created_at DESC);

    -- Add foreign key constraint for user_id
    -- Note: References the first part of business_users composite primary key
    -- ON DELETE SET NULL to preserve audit logs even after user deletion
    ALTER TABLE accounter_schema.audit_logs
      ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES accounter_schema.business_users(user_id)
      ON DELETE SET NULL;
  `,
} satisfies MigrationExecutor;
