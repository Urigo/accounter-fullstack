import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-13T10-00-00.fix-invitations-unique-index.sql',
  run: ({ sql }) => sql`
    -- Relax the pending-invitation uniqueness constraint so that expired-but-unaccepted
    -- invitations no longer block new inserts for the same (business_id, email) pair.
    -- NOW() is STABLE (not IMMUTABLE) and cannot appear in an index predicate, so the
    -- constraint only filters on accepted_at IS NULL.  The application already calls
    -- expireActiveInvitations before every insert to set expires_at = NOW() on stale rows,
    -- ensuring at most one active (unexpired) invitation exists at the application level.
    DROP INDEX IF EXISTS accounter_schema.idx_invitations_unique_pending;
    CREATE UNIQUE INDEX idx_invitations_unique_pending
      ON accounter_schema.invitations (business_id, email)
      WHERE accepted_at IS NULL;
  `,
} satisfies MigrationExecutor;
