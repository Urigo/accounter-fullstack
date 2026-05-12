import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Enable RLS on super_admins with read-only access for the app user.
 * The app can SELECT (to verify super-admin status) but cannot INSERT/UPDATE/DELETE
 * (mutations must go through a privileged DBA connection, not the app).
 * This prevents a compromised app from self-promoting to super-admin.
 */
export default {
  name: '2026-05-12T17-30-00.rls-super-admins-read-only.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.super_admins ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.super_admins FORCE ROW LEVEL SECURITY;

    CREATE POLICY super_admins_select ON accounter_schema.super_admins
      FOR SELECT
      USING (true);
  `,
} satisfies MigrationExecutor;
