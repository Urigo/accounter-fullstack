import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-04-15T17-27-28.pcn874.sql',
  run: ({ sql }) => sql`
create table if not exists accounter_schema.pcn874
(
    business_id uuid not null
        constraint pcn874_businesses_id_fk
            references accounter_schema.businesses,
    month_date  date not null,
    content     text not null,
    constraint pcn874_pk
        primary key (business_id, month_date)
);

create unique index if not exists pcn874_business_id_month_date_uindex
    on accounter_schema.pcn874 (business_id, month_date);
`,
} satisfies MigrationExecutor;
