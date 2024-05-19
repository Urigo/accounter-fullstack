import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-05-19T13-36-34.fix-updated-at-triggers.sql',
  run: ({ sql }) => sql`
    drop trigger update_charge_updated_at on accounter_schema.charges;
    drop trigger update_transaction_updated_at on accounter_schema.transactions;
    drop trigger update_financial_entities_updated_at on accounter_schema.financial_entities;
    drop trigger update_ledger_records_updated_at on accounter_schema.ledger_records;
    create trigger update_charge_updated_at
        before update
        on accounter_schema.charges
        for each row
    execute procedure accounter_schema.update_general_updated_at();
    create trigger update_transaction_updated_at
        before update
        on accounter_schema.transactions
        for each row
    execute procedure accounter_schema.update_general_updated_at();
    create trigger update_financial_entities_updated_at
        before update
        on accounter_schema.financial_entities
        for each row
    execute procedure accounter_schema.update_general_updated_at();
    create trigger update_ledger_records_updated_at
        before update
        on accounter_schema.ledger_records
        for each row
    execute procedure accounter_schema.update_general_updated_at();
`,
} satisfies MigrationExecutor;
