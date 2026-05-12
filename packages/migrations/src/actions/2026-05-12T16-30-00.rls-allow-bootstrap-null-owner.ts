import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Drop the self-owned bootstrap policy added in 16-00-00 (insufficient due to FK ordering)
 * and replace with a policy that allows INSERT when id = current_business_id regardless of owner_id.
 * This lets bootstrapNewClient insert financial_entities with owner_id=NULL first (to satisfy FK
 * ordering), create the businesses row, then update owner_id to self.
 */
export default {
  name: '2026-05-12T16-30-00.rls-allow-bootstrap-null-owner.sql',
  run: ({ sql }) => sql`
    DROP POLICY IF EXISTS allow_self_owned_bootstrap ON accounter_schema.financial_entities;
    DROP POLICY IF EXISTS allow_self_owned_bootstrap ON accounter_schema.businesses;

    -- Allow INSERT of the root tenant entity: the new entity's ID matches the declared business context
    CREATE POLICY allow_bootstrap_root ON accounter_schema.financial_entities
      FOR INSERT
      WITH CHECK (id = accounter_schema.get_current_business_id());

    CREATE POLICY allow_bootstrap_root ON accounter_schema.businesses
      FOR INSERT
      WITH CHECK (id = accounter_schema.get_current_business_id());

    -- Allow the subsequent self-owner UPDATE on financial_entities
    CREATE POLICY allow_bootstrap_owner_update ON accounter_schema.financial_entities
      FOR UPDATE
      USING (id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = id);
  `,
} satisfies MigrationExecutor;
