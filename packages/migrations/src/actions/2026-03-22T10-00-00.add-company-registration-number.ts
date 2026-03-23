import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-22T10-00-00.add-company-registration-number.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.workspace_settings
      ADD COLUMN IF NOT EXISTS company_registration_number TEXT;
  `,
} satisfies MigrationExecutor;
