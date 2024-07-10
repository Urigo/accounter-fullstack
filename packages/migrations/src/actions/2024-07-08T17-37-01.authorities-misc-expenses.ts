import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-07-08T17-37-01.authorities-misc-expenses.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.businesses
      add is_authority boolean;

    create table if not exists accounter_schema.authorities_misc_expenses
    (
        transaction_id uuid          not null
            constraint authorities_misc_expenses_transaction_id_fk
                references accounter_schema.transactions,
        amount         numeric(8, 2) not null,
        description    text,
        counterparty   uuid          not null
            constraint authorities_misc_expenses_financial_entities_id_fk
                references accounter_schema.financial_entities,
        date           date          not null,
        constraint authorities_misc_expenses_pk
            primary key (transaction_id, counterparty, date)
    );

    create index if not exists authorities_misc_expenses_transaction_id_index
        on accounter_schema.authorities_misc_expenses (transaction_id);
`,
} satisfies MigrationExecutor;
