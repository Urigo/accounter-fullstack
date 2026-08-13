import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-13T12-00-00.add-poalim-securities-transactions-table.sql',
  run: ({ sql }) => sql`
    -- Executed activity inside a Poalim securities portfolio, scraped from the "mytrade"
    -- order executions history API (Account.Execution[]). This is the activity feed;
    -- accounter_schema.poalim_securities holds the static reference info for the same
    -- portfolio and the two join on security / security_key.
    --
    -- Like poalim_securities these rows do not become cash movements on their own: no
    -- insert trigger and no transactions_raw_list column.
    --
    -- Columns are kept 1:1 with the source field names, including the bank's own
    -- misspellings (IsraeTaxValue, PeymentPecentage, TradeCurrnecyRate,
    -- LastTranactionDate, FundPlusAccumulatedInerestValue) so the mapping from the
    -- response stays mechanical and greppable.
    CREATE TABLE accounter_schema.poalim_securities_transactions (
      id                                            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_id                                      UUID        NOT NULL REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,

      -- account identity; mytrade addresses accounts as branch-account and the response
      -- rows carry Branch/Account, but these are stamped from the requested account so
      -- they always agree with the other poalim_* tables
      bank_number                                   INTEGER     NOT NULL,
      branch_number                                 INTEGER     NOT NULL,
      account_number                                INTEGER     NOT NULL,

      -- identity of the execution
      security                                      TEXT        NOT NULL,
      trade_date                                    TIMESTAMPTZ NOT NULL,
      value_date                                    TIMESTAMPTZ,
      settlement_date                               TIMESTAMPTZ,
      trade_type                                    TEXT        NOT NULL,
      transaction_type                              TEXT        NOT NULL,
      nv                                            NUMERIC,
      trade_price                                   NUMERIC,
      net_value_trade_currency                      NUMERIC,
      payment_type                                  TEXT,
      payment_date                                  TIMESTAMPTZ,
      ex_date                                       TIMESTAMPTZ,
      cancel_date                                   TIMESTAMPTZ,

      -- security descriptors
      isin                                          TEXT,
      symbol                                        TEXT,
      symbol_osi                                    TEXT,
      eng_name                                      TEXT,
      heb_name                                      TEXT,
      eng_name_full                                 TEXT,
      heb_name_full                                 TEXT,
      security_group                                TEXT,
      security_sub_group                            TEXT,
      issue_currency                                TEXT,
      issuer_country                                TEXT,
      issuer_country_code                           TEXT,
      issuer_exchange                               TEXT,
      exchange_country                              TEXT,
      is_tradable                                   TEXT,
      is_us_equity                                  TEXT,
      is_jumbo                                      BOOLEAN,
      implied_asset_mult                            NUMERIC,
      expiry_date                                   TEXT,

      -- values, commissions and taxes
      trade_currency                                TEXT,
      settlement_currency                           TEXT,
      commissions_currency                          TEXT,
      payment_currency                              TEXT,
      trade_gross_value_trade_currency              NUMERIC,
      trade_gross_value_nis                         NUMERIC,
      net_value_nis                                 NUMERIC,
      net_value_settlement_currency                 NUMERIC,
      settlement_price                              NUMERIC,
      trade_commission_percent                      NUMERIC,
      trade_commission_value_nis                    NUMERIC,
      trade_commission_value_trade_currency         NUMERIC,
      agent_commission_value_trade_currency         NUMERIC,
      management_fees_percent                       NUMERIC,
      management_fees_value_nis                     NUMERIC,
      management_fees_value_trade_currency          NUMERIC,
      israe_tax_value                               NUMERIC,
      israel_tax_percent                            NUMERIC,
      israel_tax_value_by_payments_settlement_currency NUMERIC,
      foreign_tax_percent                           NUMERIC,
      foreign_tax_value_settlement_currency         NUMERIC,
      capital_tax_percent                           NUMERIC,
      capital_tax_value_settlement_currency         NUMERIC,
      post_deduction_tax_value_nis                  NUMERIC,
      previous_actions_deductions                   NUMERIC,
      post_action_deduction_balance                 NUMERIC,
      nominal_profit_loss_nis                       NUMERIC,
      nominal_profit_loss_linkage                   NUMERIC,
      real_profit_loss_nis                          NUMERIC,
      accumulated_interest                          NUMERIC,
      fund_plus_accumulated_inerest_value           NUMERIC,
      peyment_pecentage                             NUMERIC,
      payment_linking_value                         NUMERIC,
      ex_date_balance                               NUMERIC,
      issue_currency_to_trade_currency_rate         NUMERIC,
      trade_currnecy_rate                           NUMERIC,
      personal_currency_rate                        NUMERIC,

      -- order / execution metadata
      payment_name                                  TEXT,
      order_origin                                  TEXT,
      order_type                                    TEXT,
      order_subject                                 TEXT,
      ordered_nv                                    NUMERIC,
      executed_nv                                   NUMERIC,
      ordered_value                                 NUMERIC,
      execution_date                                TIMESTAMPTZ,
      last_tranaction_date                          TIMESTAMPTZ,
      is_cancel_transaction                         TEXT,
      executing_branch                              TEXT,
      financial_account_branch                      TEXT,
      financial_account_number                      TEXT,
      account_name                                  TEXT
    );

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.security IS
      'Source field "Security": Poalim''s security identifier, joins to accounter_schema.poalim_securities.security_key';

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.israe_tax_value IS
      'Source field "IsraeTaxValue" — the missing "l" is the bank''s, kept for source fidelity';

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.peyment_pecentage IS
      'Source field "PeymentPecentage" — spelling is the bank''s, kept for source fidelity';

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.trade_currnecy_rate IS
      'Source field "TradeCurrnecyRate" — spelling is the bank''s, kept for source fidelity';

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.last_tranaction_date IS
      'Source field "LastTranactionDate" — spelling is the bank''s, kept for source fidelity';

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.fund_plus_accumulated_inerest_value IS
      'Source field "FundPlusAccumulatedInerestValue" — spelling is the bank''s, kept for source fidelity';

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.expiry_date IS
      'Source field is always null in observed data; kept TEXT rather than TIMESTAMPTZ until the format is known';

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.execution_date IS
      'The bank sends the sentinel 0001-01-01T00:00:00 for executions with no recorded execution timestamp';

    ALTER TABLE accounter_schema.poalim_securities_transactions
      ENABLE ROW LEVEL SECURITY;

    ALTER TABLE accounter_schema.poalim_securities_transactions
      FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.poalim_securities_transactions
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    -- The response carries no per-execution id, so the natural key is the set of fields
    -- that distinguish two same-day executions on the same security: direction, size,
    -- price, net value and the corporate-action dates. Verified unique across a full
    -- year of real executions. NULLS NOT DISTINCT because most of those columns are
    -- null for plain buy/sell rows.
    CREATE UNIQUE INDEX poalim_securities_transactions_dedup_uindex
      ON accounter_schema.poalim_securities_transactions (
        owner_id,
        bank_number,
        branch_number,
        account_number,
        security,
        trade_date,
        value_date,
        settlement_date,
        trade_type,
        transaction_type,
        nv,
        trade_price,
        net_value_trade_currency,
        payment_type,
        payment_date,
        ex_date,
        cancel_date
      )
      NULLS NOT DISTINCT;

    CREATE INDEX poalim_securities_transactions_owner_id_idx
      ON accounter_schema.poalim_securities_transactions (owner_id);

    CREATE INDEX poalim_securities_transactions_account_trade_date_idx
      ON accounter_schema.poalim_securities_transactions (bank_number, branch_number, account_number, trade_date);
  `,
} satisfies MigrationExecutor;
