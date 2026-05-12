import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-12T14-00-00.create-super-admins-table.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.super_admins (
      auth0_user_id TEXT PRIMARY KEY,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      note          TEXT
    );
  `,
} satisfies MigrationExecutor;
