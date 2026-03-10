import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-10T15-00-00.add-user-id-to-invitations.sql',
  run: ({ sql }) => sql`
    -- Add deterministic invitation target user reference.

    ALTER TABLE accounter_schema.invitations
      ADD COLUMN user_id UUID;

    CREATE INDEX idx_invitations_user_id ON accounter_schema.invitations(user_id);

    ALTER TABLE accounter_schema.invitations
      ADD CONSTRAINT invitations_user_business_fkey
      FOREIGN KEY (user_id, business_id)
      REFERENCES accounter_schema.business_users(user_id, business_id)
      ON DELETE CASCADE;

    COMMENT ON COLUMN accounter_schema.invitations.user_id IS 'Deterministic local user identifier linked to this invitation';
  `,
} satisfies MigrationExecutor;
