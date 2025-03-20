import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-03-19T12-05-43.deel-api-tables.sql',
  run: ({ sql }) => sql`
create table if not exists accounter_schema.deel_invoices
(
    id                           varchar(21)               not null
        constraint deel_invoices_pk
            primary key,
    document_id                  uuid
        constraint deel_invoices_documents_id_fk
            references accounter_schema.documents,
    amount                       numeric(9, 2)             not null,
    contract_id                  varchar(10),
    created_at                   timestamp with time zone  not null,
    currency                     accounter_schema.currency not null,
    deel_fee                     numeric(9, 2)             not null,
    due_date                     timestamp with time zone  not null,
    is_overdue                   boolean                   not null,
    issued_at                    timestamp with time zone  not null,
    label                        text                      not null,
    paid_at                      timestamp with time zone  not null,
    status                       varchar(12)               not null,
    total                        numeric(9, 2)             not null,
    vat_id                       varchar(1),
    vat_percentage               varchar(1),
    vat_total                    numeric(9, 2),
    adjustment                   numeric(9, 2)             not null,
    approve_date                 timestamp with time zone,
    approvers                    text,
    bonus                        numeric(9, 2)             not null,
    commissions                  numeric(9, 2)             not null,
    contract_country             varchar(2),
    contract_start_date          timestamp with time zone,
    contractor_email             text,
    contractor_employee_name     text                      not null,
    contractor_unique_identifier uuid,
    deductions                   numeric(9, 2)             not null,
    expenses                     numeric(9, 2)             not null,
    frequency                    varchar(10),
    general_ledger_account       varchar(1),
    others                       numeric(9, 2)             not null,
    overtime                     numeric(9, 2)             not null,
    payment_currency             accounter_schema.currency not null,
    pro_rata                     numeric(9, 2)             not null,
    processing_fee               numeric(9, 2)             not null,
    work                         numeric(9, 2)             not null,
    total_payment_currency       numeric(9, 2)             not null,
    payment_id                   varchar(21)               not null
);

create index if not exists deel_invoices_document_id_index
    on accounter_schema.deel_invoices (document_id);

create unique index if not exists deel_invoices_id_uindex
    on accounter_schema.deel_invoices (id);

create index if not exists deel_invoices_payment_id_index
    on accounter_schema.deel_invoices (payment_id);

create table if not exists accounter_schema.deel_workers
(
    contract_id         varchar(10)              not null
        constraint deel_workers_pk
            primary key,
    contractor_id       uuid                     not null,
    contractor_name     text                     not null,
    contract_start_date timestamp with time zone not null,
    business_id         uuid                     not null
        constraint deel_workers_businesses_id_fk
            references accounter_schema.businesses
);

create index if not exists deel_workers__index
    on accounter_schema.deel_workers (business_id);

create index if not exists deel_workers_contract_id_index
    on accounter_schema.deel_workers (contract_id);

create index if not exists deel_workers_contractor_id_index
    on accounter_schema.deel_workers (contractor_id);
`,
} satisfies MigrationExecutor;
