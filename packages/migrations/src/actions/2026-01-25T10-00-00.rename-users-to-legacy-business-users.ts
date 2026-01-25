import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-01-25T10-00-00.rename-users-to-legacy-business-users.sql',
  run: ({ sql }) => sql`
    -- PHASE 1: Duplicate the existing 'users' table to 'legacy_business_users'
    -- This is necessary because the current 'users' table actually stores business information,
    -- not user accounts. This migration prepares the database for the new user authentication system
    -- which will introduce a proper 'users' table for personal user accounts.
    --
    -- We duplicate the table instead of renaming to allow zero-downtime deployment.
    -- After deployment and verification that the server uses only the new table,
    -- the old 'users' table will be dropped in a subsequent migration.

    -- Create the new table with the same structure
    CREATE TABLE accounter_schema.legacy_business_users (LIKE accounter_schema.users INCLUDING ALL);

    -- Copy all data from the old table to the new table
    INSERT INTO accounter_schema.legacy_business_users SELECT * FROM accounter_schema.users;

    -- Recreate the foreign key constraint to financial_entities
    ALTER TABLE accounter_schema.legacy_business_users
      ADD CONSTRAINT fk_legacy_business_users_id 
      FOREIGN KEY (id) 
      REFERENCES accounter_schema.financial_entities (id) 
      ON UPDATE CASCADE 
      ON DELETE CASCADE;
  `,
} satisfies MigrationExecutor;
