import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-07-23T11-00-24.support-sek-currency.sql',
  run: ({ sql }) => sql`
ALTER TYPE accounter_schema.currency ADD VALUE 'SEK';

alter table accounter_schema.exchange_rates
    add sek numeric(5, 4);
`,
} satisfies MigrationExecutor;
