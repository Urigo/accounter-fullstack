import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-07-03T17-09-04.extended-charge-type-enum.sql',
  run: ({ sql }) => sql`
    ALTER TYPE accounter_schema.charge_type ADD VALUE 'REVALUATION';

    alter table accounter_schema.ledger_records
      add constraint ledger_records_charges_id_fk
          foreign key (charge_id) references accounter_schema.charges;
`,
} satisfies MigrationExecutor;
