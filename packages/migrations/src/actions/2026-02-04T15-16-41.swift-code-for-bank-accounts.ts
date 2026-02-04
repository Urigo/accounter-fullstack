import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-04T15-16-41.swift-code-for-bank-accounts.sql',
  run: ({ sql }) => sql`
    ALTER TABLE "accounter_schema"."financial_bank_accounts"
    ADD COLUMN "swift_code" VARCHAR(255) NULL;
  `,
} satisfies MigrationExecutor;
