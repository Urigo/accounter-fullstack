import type { MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-19T13-00-00.add-priority-provider',
  run: ({ sql }) => sql`
    ALTER TYPE accounter_schema.source_provider ADD VALUE IF NOT EXISTS 'priority';
  `,
} satisfies MigrationExecutor;
