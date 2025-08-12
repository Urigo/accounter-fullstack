import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-08-12T18-50-12.extend-isracard-table.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.isracard_creditcard_transactions
    add esb_services_call text;

alter table accounter_schema.amex_creditcard_transactions
    add esb_services_call text;
`,
} satisfies MigrationExecutor;
