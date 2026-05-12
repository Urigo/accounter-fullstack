import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Add a supplemental RLS policy on financial_entities and businesses that allows
 * a row to be inserted when owner_id = id (self-owned / bootstrap case).
 * This unblocks the bootstrapNewClient flow which must create an admin entity
 * that owns itself before any other business context exists.
 */
export default {
  name: '2026-05-12T16-00-00.rls-allow-self-owned-bootstrap.sql',
  run: ({ sql }) => sql`
    -- Allow self-owned entities (owner_id = id) to be inserted without a pre-existing
    -- business context. Used exclusively by bootstrapNewClient to create new tenants.
    CREATE POLICY allow_self_owned_bootstrap ON accounter_schema.financial_entities
      FOR INSERT
      WITH CHECK (owner_id = id);

    CREATE POLICY allow_self_owned_bootstrap ON accounter_schema.businesses
      FOR INSERT
      WITH CHECK (owner_id = id);
  `,
} satisfies MigrationExecutor;
