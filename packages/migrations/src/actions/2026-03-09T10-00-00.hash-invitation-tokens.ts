import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-09T10-00-00.hash-invitation-tokens.sql',
  run: ({ sql }) => sql`
    -- Migrate invitation tokens from plaintext to SHA-256 hash storage.
    -- This migration intentionally assumes there are no existing invitations.

    ALTER TABLE accounter_schema.invitations
      ADD COLUMN token_hash TEXT;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM accounter_schema.invitations) THEN
        RAISE EXCEPTION USING
          MESSAGE = 'Invitation token hash migration requires empty invitations table',
          HINT = 'No pgcrypto extension is available on this database. Clear pending invitations before running this migration.';
      END IF;
    END;
    $$;

    ALTER TABLE accounter_schema.invitations
      ALTER COLUMN token_hash SET NOT NULL;

    ALTER TABLE accounter_schema.invitations
      ADD CONSTRAINT invitations_token_hash_key UNIQUE (token_hash);

    ALTER TABLE accounter_schema.invitations
      DROP CONSTRAINT IF EXISTS invitations_token_key;

    ALTER TABLE accounter_schema.invitations
      DROP COLUMN token;

    COMMENT ON COLUMN accounter_schema.invitations.token_hash IS 'SHA-256 hash of invitation token (never store plaintext token)';
  `,
} satisfies MigrationExecutor;
