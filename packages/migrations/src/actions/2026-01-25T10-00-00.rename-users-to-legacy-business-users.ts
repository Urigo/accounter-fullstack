import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-01-25T10-00-00.rename-users-to-legacy-business-users.sql',
  run: ({ sql }) => sql`
    -- Rename the existing 'users' table to 'legacy_business_users'
    -- This is necessary because the current 'users' table actually stores business information,
    -- not user accounts. This migration prepares the database for the new user authentication system
    -- which will introduce a proper 'users' table for personal user accounts.
    --
    -- PostgreSQL automatically updates all foreign key constraints to reference the new table name,
    -- so no additional ALTER TABLE statements are needed for foreign key maintenance.
    ALTER TABLE accounter_schema.users RENAME TO legacy_business_users;
  `,
} satisfies MigrationExecutor;
