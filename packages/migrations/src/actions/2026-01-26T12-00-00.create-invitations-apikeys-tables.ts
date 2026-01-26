import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-01-26T12-00-00.create-invitations-apikeys-tables.sql',
  run: ({ sql }) => sql`
    -- Migration: Create Invitations and API Keys Tables
    -- 
    -- This migration creates tables for invitation management (Auth0 pre-registration)
    -- and API key authentication (independent of Auth0).
    --
    -- Key Design Decisions:
    -- 1. Invitations trigger Auth0 Management API calls to create blocked users
    -- 2. Auth0 user is unblocked only after user sets password and accepts invitation
    -- 3. API keys provide authentication independent of Auth0 for automated processes
    -- 4. API keys use SHA-256 hashed storage for security

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
      name TEXT,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE accounter_schema.api_keys IS 'API keys are independent of Auth0, used for programmatic access (e.g., scraper role)';
    COMMENT ON COLUMN accounter_schema.api_keys.id IS 'Unique API key identifier';
    COMMENT ON COLUMN accounter_schema.api_keys.business_id IS 'Business this API key belongs to';
    COMMENT ON COLUMN accounter_schema.api_keys.role_id IS 'Role assigned to this API key (e.g., ''scraper'')';
    COMMENT ON COLUMN accounter_schema.api_keys.key_hash IS 'SHA-256 hash of the API key (never store plaintext keys)';
    COMMENT ON COLUMN accounter_schema.api_keys.name IS 'Descriptive name for this API key (e.g., ''Production Scraper'')';
    COMMENT ON COLUMN accounter_schema.api_keys.last_used_at IS 'Timestamp of last API key usage (updated hourly to prevent write amplification)';
    COMMENT ON COLUMN accounter_schema.api_keys.created_at IS 'Timestamp when API key was created';

    -- Create indexes for efficient lookups
    CREATE INDEX idx_api_keys_business_id ON accounter_schema.api_keys(business_id);

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
  `,
} satisfies MigrationExecutor;
