import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-09T15-50-45.deel-invoices-adjustments.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.deel_invoices
    alter column currency type text using currency::text;

alter table accounter_schema.deel_invoices
    alter column amount type numeric(11, 2) using amount::numeric(11, 2);

alter table accounter_schema.deel_invoices
    alter column total type numeric(11, 2) using total::numeric(11, 2);

alter table accounter_schema.deel_invoices
    alter column work type numeric(11, 2) using work::numeric(11, 2);
`,
} satisfies MigrationExecutor;
