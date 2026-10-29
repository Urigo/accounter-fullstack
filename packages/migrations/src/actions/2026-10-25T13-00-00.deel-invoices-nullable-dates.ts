import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Deel sends `due_date` and `paid_at` as `''` when an invoice has none (e.g. an unpaid invoice), and
 * those invoices couldn't be stored at all. They are stored as NULL instead.
 */
export default {
  name: '2026-10-25T13-00-00.deel-invoices-nullable-dates.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.deel_invoices
      ALTER COLUMN due_date DROP NOT NULL,
      ALTER COLUMN paid_at DROP NOT NULL;
  `,
} satisfies MigrationExecutor;
