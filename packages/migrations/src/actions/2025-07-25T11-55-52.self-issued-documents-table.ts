import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-07-25T11-55-52.self-issued-documents-table.sql',
  run: ({ sql }) => sql`
CREATE TYPE accounter_schema.document_status AS ENUM ('OPEN', 'CLOSED', 'MANUALLY_CLOSED', 'CANCELLED', 'CANCELLED_BY_OTHER_DOC');

create table if not exists accounter_schema.documents_issued
(
    id                  uuid                  not null
        constraint documents_issued_pk
            primary key
        constraint documents_issued_documents_id_fk
            references accounter_schema.documents,
    external_id         text                  not null,
    status accounter_schema.document_status default 'OPEN' not null,
    linked_document_ids uuid[]
);

alter table accounter_schema.documents_issued
    add constraint documents_issued_pk_2
        unique (external_id);
`,
} satisfies MigrationExecutor;
