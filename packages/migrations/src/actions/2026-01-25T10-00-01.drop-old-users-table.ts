import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-01-25T10-00-01.drop-old-users-table.sql',
  run: ({ sql }) => sql`
    -- PHASE 2: Drop the old 'users' table
    -- This migration should only be run AFTER:
    -- 1. The first migration (duplicate table) has been deployed
    -- 2. The server code has been updated to use 'legacy_business_users'
    -- 3. It has been verified in production that the old 'users' table is no longer being queried
    --
    -- This completes the table rename by removing the legacy table name.
    DROP TABLE IF EXISTS accounter_schema.users;
  `,
} satisfies MigrationExecutor;
