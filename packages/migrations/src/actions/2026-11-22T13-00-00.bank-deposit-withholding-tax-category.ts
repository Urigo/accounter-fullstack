import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Adds `user_context.bank_deposit_withholding_tax_category_id`: the account (withholding tax
 * receivable, ניכוי במקור) that tax withheld by the bank on deposit interest is booked to. Only
 * needed by tenants whose deposits are actually taxed at source, hence nullable.
 */
export default {
  name: '2026-11-22T13-00-00.bank-deposit-withholding-tax-category.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.user_context
      ADD COLUMN IF NOT EXISTS bank_deposit_withholding_tax_category_id UUID NULL
        REFERENCES accounter_schema.tax_categories (id);
  `,
} satisfies MigrationExecutor;
