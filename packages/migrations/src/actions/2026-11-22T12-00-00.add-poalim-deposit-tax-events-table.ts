import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Poalim deposits tax events, scraped from the "tax collection" screen of deposits and savings
 * (`deposits-and-savings/taxCollection?view=savingsAndCurrentProducts`), one row per item of
 * `savingsAndCurrentProductsTaxEvents[]`.
 *
 * On every principal event of a deposit (top-up or withdrawal) the bank realizes the interest
 * accrued on the whole deposit: the share of the withdrawn amount is paid out ("משיכה" rows), the
 * rest is re-deposited silently ("תשלום ריבית ל" rows), and tax is charged / credited per row
 * (`debit_amount` / `crdit_amount`). These rows are what the deposit ledger needs to book the
 * capitalized interest and the withheld tax, neither of which ever shows up as a cash movement.
 *
 * Like `poalim_securities_transactions`, the rows are not cash movements: no insert trigger and no
 * `transactions_raw_list` column.
 *
 * Columns are kept 1:1 with the source field names, including the bank's own misspelling
 * (`crditAmount`), so the mapping from the response stays mechanical and greppable. The response
 * rows carry no account: bank / branch / account are stamped from the requested account.
 *
 * `eventSerialNumber` restarts every day, so the natural key is account + executing date + serial.
 *
 * RLS follows `2026-10-21T14-00-00.charges-securities-executions`. The same policies are applied to
 * `bank_deposits`, which carries an `owner_id` but was never given RLS (the one exemption in
 * `rls-all-tables.test.ts`), and which the deposit ledger now reads alongside this table.
 */
export default {
  name: '2026-11-22T12-00-00.add-poalim-deposit-tax-events-table.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.poalim_deposit_tax_events (
      id                                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_id                                UUID        NOT NULL
                                                          REFERENCES accounter_schema.businesses (id) ON DELETE CASCADE,

      -- account identity, stamped from the requested account
      bank_number                             INTEGER     NOT NULL,
      branch_number                           INTEGER     NOT NULL,
      account_number                          INTEGER     NOT NULL,

      -- savingsAndCurrentProductsTaxEvents[] fields
      event_serial_number                     INTEGER     NOT NULL,
      executing_date                          DATE        NOT NULL,
      formatted_executing_date                TIMESTAMPTZ,
      action_type_description                 TEXT        NOT NULL,
      short_product_name                      TEXT,
      tax_action_type_description             TEXT,
      tax_event_amount                        NUMERIC     NOT NULL,
      debit_currency_shorted_description      TEXT,
      debit_amount                            NUMERIC     NOT NULL,
      crdit_amount                            NUMERIC     NOT NULL,
      additional_information_existence_switch INTEGER,

      created_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT poalim_deposit_tax_events_natural_key UNIQUE
        (owner_id, bank_number, branch_number, account_number, executing_date, event_serial_number)
    );

    COMMENT ON TABLE accounter_schema.poalim_deposit_tax_events IS
      'Poalim deposits tax events (interest realized per deposit event, paid out or capitalized, and the tax charged / credited on it), 1:1 with savingsAndCurrentProductsTaxEvents[]';

    CREATE INDEX IF NOT EXISTS poalim_deposit_tax_events_account_date_idx
      ON accounter_schema.poalim_deposit_tax_events (owner_id, account_number, executing_date);

    ALTER TABLE accounter_schema.poalim_deposit_tax_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.poalim_deposit_tax_events FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.poalim_deposit_tax_events;
    CREATE POLICY tenant_isolation ON accounter_schema.poalim_deposit_tax_events
      FOR ALL
      USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.poalim_deposit_tax_events;
    CREATE POLICY tenant_isolation_delete ON accounter_schema.poalim_deposit_tax_events
      AS RESTRICTIVE
      FOR DELETE
      USING (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_update ON accounter_schema.poalim_deposit_tax_events;
    CREATE POLICY tenant_isolation_update ON accounter_schema.poalim_deposit_tax_events
      AS RESTRICTIVE
      FOR UPDATE
      USING (owner_id = accounter_schema.get_current_business_id());

    -- bank_deposits: close the known RLS gap
    ALTER TABLE accounter_schema.bank_deposits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.bank_deposits FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.bank_deposits;
    CREATE POLICY tenant_isolation ON accounter_schema.bank_deposits
      FOR ALL
      USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.bank_deposits;
    CREATE POLICY tenant_isolation_delete ON accounter_schema.bank_deposits
      AS RESTRICTIVE
      FOR DELETE
      USING (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_update ON accounter_schema.bank_deposits;
    CREATE POLICY tenant_isolation_update ON accounter_schema.bank_deposits
      AS RESTRICTIVE
      FOR UPDATE
      USING (owner_id = accounter_schema.get_current_business_id());
  `,
} satisfies MigrationExecutor;
