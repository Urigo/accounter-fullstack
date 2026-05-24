import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-24T10-00-00.support-uah-currency.sql',
  run: ({ sql }) => sql`
ALTER TYPE accounter_schema.currency ADD VALUE 'UAH';

alter table accounter_schema.exchange_rates
    add uah numeric(12, 6);
`,
} satisfies MigrationExecutor;
