import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-12-20T08-23-25.use-businesses-for-foreign-keys.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.documents
    drop constraint documents_financial_entities_id_fk;

alter table accounter_schema.documents
    add constraint documents_businesses_id_fk_2
        foreign key (creditor_id) references accounter_schema.businesses;

alter table accounter_schema.documents
    drop constraint documents_financial_entities_id_fk_2;

alter table accounter_schema.documents
    add constraint documents_businesses_id_fk
        foreign key (debtor_id) references accounter_schema.businesses;
`,
} satisfies MigrationExecutor;
