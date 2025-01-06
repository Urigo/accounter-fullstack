import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-01-05T18-20-42.vat-table.sql',
  run: ({ sql }) => sql`
create table if not exists accounter_schema.vat_value
(
    date       date          not null
        constraint vat_value_pk
            primary key,
    percentage numeric(3, 2) not null
);

create unique index if not exists vat_value_date_uindex
    on accounter_schema.vat_value (date);
`,
} satisfies MigrationExecutor;
