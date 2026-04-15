import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-04-13T13-00-00.dynamic-report-templates-lock.sql',
  run: ({ sql }) => sql`
ALTER TABLE accounter_schema.dynamic_report_templates
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT FALSE;
`,
} satisfies MigrationExecutor;
