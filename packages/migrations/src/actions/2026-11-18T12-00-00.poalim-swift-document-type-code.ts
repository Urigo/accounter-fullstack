import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Adds `poalim_swift_account_transactions.document_type_code`. Poalim's SWIFT list used to send
 * `null` here and now sends an integer code on every item.
 *
 * Nullable: rows scraped before the change have no code.
 */
export default {
  name: '2026-11-18T12-00-00.poalim-swift-document-type-code.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.poalim_swift_account_transactions
      ADD COLUMN IF NOT EXISTS document_type_code INTEGER NULL;
  `,
} satisfies MigrationExecutor;
