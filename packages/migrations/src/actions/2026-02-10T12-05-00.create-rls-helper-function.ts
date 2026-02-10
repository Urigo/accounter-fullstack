import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-10T12-05-00.create-rls-helper-function.sql',
  run: ({ sql }) => sql`
    -- Function to get current business ID (mandatory context)
    CREATE OR REPLACE FUNCTION accounter_schema.get_current_business_id()
    RETURNS UUID
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
    DECLARE
      v_business_id UUID;
    BEGIN
      -- STABLE: result won't change within transaction
      -- SECURITY DEFINER: runs with creator privileges to read session variables
      -- Handle both NULL and empty string cases
      v_business_id := NULLIF(current_setting('app.current_business_id', true), '')::uuid;
      
      IF v_business_id IS NULL THEN
        RAISE EXCEPTION 'No business context set - authentication required';
      END IF;
      
      RETURN v_business_id;
    END;
    $$;

    -- Function to get current user ID (optional/nullable)
    CREATE OR REPLACE FUNCTION accounter_schema.get_current_user_id()
    RETURNS UUID
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
    DECLARE
      v_user_id UUID;
    BEGIN
      v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
      RETURN v_user_id;
    END;
    $$;

    -- Function to get current auth type (optional/nullable)
    CREATE OR REPLACE FUNCTION accounter_schema.get_current_auth_type()
    RETURNS TEXT
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
    DECLARE
      v_auth_type TEXT;
    BEGIN
      v_auth_type := NULLIF(current_setting('app.auth_type', true), '');
      RETURN v_auth_type;
    END;
    $$;
  `,
} satisfies MigrationExecutor;
