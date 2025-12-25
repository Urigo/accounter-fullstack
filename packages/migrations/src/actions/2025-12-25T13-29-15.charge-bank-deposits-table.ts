import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-12-25T13-29-15.charge-bank-deposits-table.sql',
  run: ({ sql }) => sql`
  -- create charges bank deposits table
  create table accounter_schema.charges_bank_deposits
  (
      id           uuid                  not null
          constraint charges_bank_deposits_pk
              primary key
          constraint charges_bank_deposits_charges_id_fk
              references accounter_schema.charges,
      deposit_id text,
      account_id   uuid                  not null
          constraint charges_bank_deposits_account_id_fk
              references accounter_schema.financial_accounts
  );

  -- populate charges bank deposits table from existing transactions_bank_deposits
  insert into accounter_schema.charges_bank_deposits (id, deposit_id, account_id)
  select distinct t.charge_id, tbd.deposit_id, t.account_id
  from accounter_schema.transactions t
  join accounter_schema.transactions_bank_deposits tbd on t.id = tbd.id;

  -- drop transactions bank deposits table
  DROP TABLE IF EXISTS accounter_schema.transactions_bank_deposits;
`,
} satisfies MigrationExecutor;
