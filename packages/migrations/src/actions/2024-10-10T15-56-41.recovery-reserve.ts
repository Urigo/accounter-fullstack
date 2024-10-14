import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-10-10T15-56-41.recovery-reserve.sql',
  run: ({ sql }) => sql`
    create table if not exists accounter_schema.recovery
    (
        year      integer       not null
            constraint recovery_pk
                primary key,
        day_value numeric(6, 2) not null
    );

    create unique index if not exists recovery_year_uindex
        on accounter_schema.recovery (year);
    
    alter table accounter_schema.employees
        alter column start_work_date type date using start_work_date::date;

    alter table accounter_schema.employees
        add end_work_date date;

    alter table accounter_schema.employees
        alter column start_work_date set not null;
`,
} satisfies MigrationExecutor;
