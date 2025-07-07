import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-07-07T10-30-32.support-aud-currency.sql',
  run: ({ sql }) => sql`
ALTER TYPE accounter_schema.currency ADD VALUE 'AUD';

alter table accounter_schema.exchange_rates
    add aud numeric(5, 4);
`,
} satisfies MigrationExecutor;
