import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-12-12T12-48-58.add-countries-table.sql',
  run: ({ sql }) => sql`
    create table if not exists accounter_schema.countries
    (
        name text       not null
            constraint countries_pk_2
                unique,
        code varchar(3) not null
            constraint countries_pk
                primary key
    );

    create unique index if not exists countries_code_uindex
        on accounter_schema.countries (code);

    alter table accounter_schema.business_trips
      add constraint business_trips_countries_code_fk
          foreign key (destination) references accounter_schema.countries;
`,
} satisfies MigrationExecutor;
