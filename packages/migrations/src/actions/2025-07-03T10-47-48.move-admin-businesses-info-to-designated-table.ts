import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-07-03T10-47-48.move-admin-businesses-info-to-designated-table.sql',
  run: ({ sql }) => sql`
create table if not exists accounter_schema.businesses_admin
(
    id                          uuid not null
        constraint businesses_admin_pk
            primary key
        constraint businesses_admin_businesses_id_fk
            references accounter_schema.businesses,
    tax_siduri_number_2021      text,
    password                    text,
    username_vat_website        text,
    website_login_screenshot    text,
    nikuim                      text,
    pinkas_social_security_2021 text,
    tax_pinkas_number_2020      text,
    wizcloud_token              text,
    wizcloud_company_id         text,
    advance_tax_rate            real,
    tax_nikuim_pinkas_number    text,
    vat_report_cadence          integer,
    pinkas_social_security_2022 text,
    tax_siduri_number_2022      text,
    registration_date           date
);
`,
} satisfies MigrationExecutor;
