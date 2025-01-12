import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-01-12T11-47-46.support-cad-currency.sql',
  run: ({ sql }) => sql`
ALTER TYPE accounter_schema.currency ADD VALUE 'CAD';

alter table accounter_schema.exchange_rates
    add cad numeric(5, 4);
`,
} satisfies MigrationExecutor;
