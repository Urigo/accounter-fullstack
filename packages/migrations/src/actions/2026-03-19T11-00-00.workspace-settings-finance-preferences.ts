import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-19T11-00-00.workspace-settings-finance-preferences.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.workspace_settings
      ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'ILS',
      ADD COLUMN IF NOT EXISTS aging_threshold_days INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS matching_tolerance_amount NUMERIC(10,2) DEFAULT 0.01,
      ADD COLUMN IF NOT EXISTS billing_currency TEXT,
      ADD COLUMN IF NOT EXISTS billing_payment_terms_days INTEGER DEFAULT 30;
  `,
} satisfies MigrationExecutor;
