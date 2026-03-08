import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-08T12-00-00.drop-legacy-business-users.sql',
  run: ({ sql }) => sql`
    -- Legacy auth/business bootstrap table is no longer needed after Auth0 cutover stabilization.
    DROP TABLE IF EXISTS accounter_schema.legacy_business_users CASCADE;
  `,
} satisfies MigrationExecutor;
