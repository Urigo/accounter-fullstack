import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-06-29T12-27-18.support-jpy-currency.sql',
  run: ({ sql }) => sql`
ALTER TYPE accounter_schema.currency ADD VALUE 'JPY';

alter table accounter_schema.exchange_rates
    add jpy numeric(5, 4);
`,
} satisfies MigrationExecutor;
