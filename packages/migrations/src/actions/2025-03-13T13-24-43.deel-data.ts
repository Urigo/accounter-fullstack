import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-03-13T13-24-43.deel-data.sql',
  run: ({ sql }) => sql`
create table if not exists accounter_schema.deel_employees
(
    id           integer not null
        constraint deel_employees_pk
            primary key,
    business_id uuid    not null
        constraint deel_employees_businesses_id_fk
            references accounter_schema.businesses
);

create unique index if not exists deel_employees_id_uindex
    on accounter_schema.deel_employees (id);

    create table if not exists accounter_schema.deel_documents
(
    id                          uuid default gen_random_uuid() not null
        constraint deel_documents_pk
            primary key,
    document_id                 uuid
        constraint deel_documents_documents_id_fk
            references accounter_schema.documents,
    deel_worker_id              integer
        references accounter_schema.deel_employees,
    worker_name                 text,
    entity                      text,
    payed_date                  date                           not null,
    receipt_serial              text                           not null,
    invoice_serial              text                           not null,
    invoice_date                date                           not null,
    deel_invoice_ref            text                           not null,
    contract_id                 text,
    contract_or_fee_description text,
    item_description            text                           not null,
    type_of_adjustment          text                           not null,
    amount_invoice_currency     numeric(9, 2)                  not null,
    invoice_currency            accounter_schema.currency      not null,
    amount                      numeric(9, 2)                  not null,
    currency                    accounter_schema.currency      not null
);

create unique index if not exists deel_documents_id_uindex
    on accounter_schema.deel_documents (id);
`,
} satisfies MigrationExecutor;
