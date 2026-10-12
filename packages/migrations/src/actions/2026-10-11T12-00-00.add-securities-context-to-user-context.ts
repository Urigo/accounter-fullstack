import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * The tenant's securities ledger configuration: the tax categories that dividends, bond interest,
 * withheld tax and redemption gains/losses are booked to, plus the sort code new securities tax
 * categories are created under. Every field is optional; the server parses it leniently.
 *
 * Shape (camelCase keys):
 *   { "sortCode": 990, "taxCategories": { "foreignDividendIncome": "<uuid>", ... } }
 */
export default {
  name: '2026-10-11T12-00-00.add-securities-context-to-user-context.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.user_context
      ADD COLUMN IF NOT EXISTS securities_context JSONB NOT NULL DEFAULT '{}'::jsonb
      CONSTRAINT user_context_securities_context_is_object
        CHECK (jsonb_typeof(securities_context) = 'object');
`,
} satisfies MigrationExecutor;
