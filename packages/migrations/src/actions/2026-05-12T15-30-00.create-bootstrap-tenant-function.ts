import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-12T15-30-00.create-bootstrap-tenant-function.sql',
  run: ({ sql }) => sql`
    CREATE OR REPLACE FUNCTION accounter_schema.bootstrap_tenant(
      p_admin_entity_id   UUID,
      p_business_name     TEXT,
      p_country_code      TEXT DEFAULT 'ISR'
    )
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, accounter_schema
    AS $$
    BEGIN
      -- Temporarily disable RLS for the bootstrap inserts (self-referential FK requires it)
      SET LOCAL row_security = off;

      -- Ensure country exists
      INSERT INTO accounter_schema.countries (code, name)
      VALUES (p_country_code, p_country_code)
      ON CONFLICT (code) DO NOTHING;

      -- Create the admin financial entity (owner_id = self, bypassing FK order constraint)
      INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
      VALUES (p_admin_entity_id, p_business_name, 'business', p_admin_entity_id)
      ON CONFLICT (id) DO NOTHING;

      -- Create the admin business row (name mirrors financial_entities.name)
      INSERT INTO accounter_schema.businesses (id, name, country, owner_id)
      VALUES (p_admin_entity_id, p_business_name, p_country_code, p_admin_entity_id)
      ON CONFLICT (id) DO NOTHING;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION accounter_schema.bootstrap_tenant(UUID, TEXT, TEXT) TO PUBLIC;
  `,
} satisfies MigrationExecutor;
