import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-08-11T11-45-42.clients-contracts-table.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.businesses_green_invoice_match
    rename to clients;

alter table accounter_schema.clients
    add hive_id text;

create table if not exists accounter_schema.clients_contracts
(
    id               uuid                           default gen_random_uuid()                          not null
        constraint clients_contracts_pk
            primary key,
    client_id        uuid                                                                              not null
        constraint clients_contracts_clients_business_id_fk
            references accounter_schema.clients,
    purchase_order   text,
    start_date       date                                                                              not null,
    end_date         date                                                                              not null,
    remarks          text,
    document_type    accounter_schema.document_type default 'PROFORMA'::accounter_schema.document_type not null,
    amount           double precision                                                                  not null,
    currency         accounter_schema.currency                                                         not null,
    billing_cycle    text                           default 'monthly'::text                            not null,
    product          text,
    plan             text,
    is_active        boolean,
    signed_agreement text,
    ms_cloud         text
);

create index if not exists clients_contracts_client_id_purchase_order_index
    on accounter_schema.clients_contracts (client_id, purchase_order);

create index if not exists clients_contracts_client_id_start_date_end_date_index
    on accounter_schema.clients_contracts (client_id, start_date, end_date);
`,
} satisfies MigrationExecutor;
