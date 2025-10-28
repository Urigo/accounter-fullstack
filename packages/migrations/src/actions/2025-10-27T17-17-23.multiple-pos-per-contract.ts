import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-27T17-17-23.multiple-pos-per-contract.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "accounter_schema"."clients_contracts"
ADD COLUMN
  "purchase_orders" text[] DEFAULT '{}'::TEXT[] NOT NULL;

update
  accounter_schema.clients_contracts
set
  purchase_orders = ARRAY[purchase_order]
where
  purchase_order is not null;
`,
} satisfies MigrationExecutor;
