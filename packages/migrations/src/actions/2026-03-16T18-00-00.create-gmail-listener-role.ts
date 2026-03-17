import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-16T18-00-00.create-gmail-listener-role.sql',
  run: ({ sql }) => sql`
    -- ========================================================================
    -- SEED DATA: Extra Role
    -- ========================================================================
    INSERT INTO accounter_schema.roles (id, name, description) VALUES
      ('gmail_listener', 'Gmail Listener', 'Automated role for inserting documents. Has access to businesses email configurations');
  `,
} satisfies MigrationExecutor;
