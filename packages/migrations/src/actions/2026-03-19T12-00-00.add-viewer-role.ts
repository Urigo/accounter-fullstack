import type { MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-19T12-00-00.add-viewer-role',
  run: ({ sql }) => sql`
    INSERT INTO accounter_schema.roles (id, name, description)
    VALUES ('viewer', 'Observer', 'Read-only access to workspace data; cannot create, update, or delete anything')
    ON CONFLICT (id) DO NOTHING;
  `,
} satisfies MigrationExecutor;
