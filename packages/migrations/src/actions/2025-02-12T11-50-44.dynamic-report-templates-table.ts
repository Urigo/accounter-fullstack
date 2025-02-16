import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-02-12T11-50-44.dynamic-report-templates-table.sql',
  run: ({ sql }) => sql`
create table accounter_schema.dynamic_report_templates
(
    name            text                                not null,
    owner_id        uuid                                not null
        constraint dynamic_report_templates_businesses_id_fk
            references accounter_schema.businesses,
    template text                                not null,
    created_at      timestamp default CURRENT_TIMESTAMP not null,
    updated_at      timestamp default CURRENT_TIMESTAMP not null,
    constraint dynamic_report_templates_pk
        primary key (owner_id, name)
);

create index dynamic_report_templates_owner_id_index
    on accounter_schema.dynamic_report_templates (owner_id);

create trigger update_dynamic_report_templates_updated_at
    before update
    on accounter_schema.dynamic_report_templates
    for each row
execute procedure accounter_schema.update_general_updated_at();
`,
} satisfies MigrationExecutor;
