import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Widens `depreciation_categories.percentage` from numeric(4,2) to numeric(5,2), so that a category
 * can hold a 100% rate (the API accepts 0 to 100). Widening the precision at the same scale needs
 * no table rewrite, and no view depends on the column.
 */
export default {
  name: '2026-11-24T10-30-00.depreciation-category-percentage-100.sql',
  run: ({ sql }) => sql`
ALTER TABLE accounter_schema.depreciation_categories
    ALTER COLUMN percentage TYPE numeric(5, 2);
`,
} satisfies MigrationExecutor;
