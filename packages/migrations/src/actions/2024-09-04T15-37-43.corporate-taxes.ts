import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-09-04T15-37-43.corporate-taxes.sql',
  run: ({ sql }) => sql`
        create table accounter_schema.corporate_tax_variables
        (
        corporate_id uuid    not null
                constraint corporate_tax_variables_businesses_id_fk
                references accounter_schema.businesses,
        date       date    not null,
        tax_rate   numeric not null,
        constraint corporate_tax_variables_pk
                primary key (corporate_id, date)
        );

        create index corporate_tax_variables_corporate_id_date_index
                on accounter_schema.corporate_tax_variables (corporate_id asc, date desc);
`,
} satisfies MigrationExecutor;
