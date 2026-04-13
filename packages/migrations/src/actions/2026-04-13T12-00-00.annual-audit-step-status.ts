import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-04-13T12-00-00.annual-audit-step-status.sql',
  run: ({ sql }) => sql`
create table if not exists accounter_schema.annual_audit_step_status
(
    owner_id        uuid                                not null
        constraint annual_audit_step_status_businesses_id_fk
            references accounter_schema.businesses,
    year            smallint                            not null,
    step_id         text                                not null,
    status          text                                not null,
    notes           text,
    evidence_json   jsonb,
    completed_at    timestamptz,
    created_at      timestamptz default now()           not null,
    updated_at      timestamptz default now()           not null,
    constraint annual_audit_step_status_pk
        primary key (owner_id, year, step_id),
    constraint annual_audit_step_status_status_check
        check (status in ('COMPLETED', 'IN_PROGRESS', 'PENDING', 'BLOCKED'))
);

drop trigger if exists update_annual_audit_step_status_updated_at
    on accounter_schema.annual_audit_step_status;

create trigger update_annual_audit_step_status_updated_at
    before update
    on accounter_schema.annual_audit_step_status
    for each row
execute procedure accounter_schema.update_general_updated_at();
`,
} satisfies MigrationExecutor;
