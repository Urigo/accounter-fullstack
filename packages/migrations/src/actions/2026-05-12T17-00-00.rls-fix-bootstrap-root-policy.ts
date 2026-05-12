import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Fix allow_bootstrap_root on financial_entities:
 * The FOR INSERT-only policy has no USING clause, so it doesn't help with SELECT visibility
 * and (unexpectedly) doesn't OR correctly with tenant_isolation FOR ALL's WITH CHECK in practice.
 * Replacing with FOR ALL + USING so the bootstrap entity is visible AND insertable.
 *
 * WITH CHECK allows:
 *   - id = current_business_id (root entity insert with owner_id=NULL)
 *   - owner_id = current_business_id (normal tenant rows)
 */
export default {
  name: '2026-05-12T17-00-00.rls-fix-bootstrap-root-policy.sql',
  run: ({ sql }) => sql`
    DROP POLICY IF EXISTS allow_bootstrap_root ON accounter_schema.financial_entities;

    CREATE POLICY allow_bootstrap_root ON accounter_schema.financial_entities
      FOR ALL
      USING (id = accounter_schema.get_current_business_id())
      WITH CHECK (
        id = accounter_schema.get_current_business_id()
        OR owner_id = accounter_schema.get_current_business_id()
      );
  `,
} satisfies MigrationExecutor;
