import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-10T12-10-00.enable-rls-charges-pilot.sql',
  run: ({ sql }) => sql`
    -- Enable RLS on charges table (Pilot)
    ALTER TABLE accounter_schema.charges ENABLE ROW LEVEL SECURITY;

    -- Add index on owner_id for RLS performance (if not exists)
    CREATE INDEX IF NOT EXISTS charges_owner_id_idx ON accounter_schema.charges (owner_id);

    -- Create tenant isolation policy
    -- FOR ALL: applies to SELECT, INSERT, UPDATE, DELETE
    -- USING: checks existing rows (SELECT, UPDATE, DELETE)
    -- WITH CHECK: checks new/updated rows (INSERT, UPDATE)
    CREATE POLICY tenant_isolation ON accounter_schema.charges
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    -- Force RLS for the table owner. Superusers bypass RLS by default.
    ALTER TABLE accounter_schema.charges FORCE ROW LEVEL SECURITY;
  `,
} satisfies MigrationExecutor;
