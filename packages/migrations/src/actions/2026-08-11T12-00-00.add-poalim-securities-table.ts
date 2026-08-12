import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-11T12-00-00.add-poalim-securities-table.sql',
  run: ({ sql }) => sql`
    -- Static securities reference data scraped from Poalim's "mytrade" portfolio API
    -- (View.Meta.Security). Holdings/balances are deliberately out of scope.
    --
    -- These rows are reference data, not cash movements: no insert trigger, no
    -- transactions_raw_list column. accounter_schema.poalim_deposits_account_transactions
    -- is the existing precedent for a trigger-less raw Poalim table.
    CREATE TABLE accounter_schema.poalim_securities (
      id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_id                UUID        REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE,

      -- account identity; mytrade addresses accounts as branch-account,
      -- bank_number is carried for consistency with the other poalim_* tables
      bank_number             INTEGER     NOT NULL,
      branch_number           INTEGER     NOT NULL,
      account_number          INTEGER     NOT NULL,

      -- View.Meta metadata
      as_of_date              TIMESTAMPTZ NOT NULL,

      -- View.Meta.Security fields, kept 1:1 with the source
      security_key            TEXT        NOT NULL,
      eng_name                TEXT        NOT NULL,
      heb_name                TEXT        NOT NULL,
      item_type               TEXT        NOT NULL,
      is_etf                  BOOLEAN,
      is_foreign              BOOLEAN     NOT NULL,
      currency_code           TEXT        NOT NULL,
      exchange                TEXT        NOT NULL,
      equity_type             INTEGER     NOT NULL,
      allowed_order_direction TEXT,
      equity_sub_type         INTEGER     NOT NULL,
      eng_symbol              TEXT,
      heb_symbol              TEXT,
      symbol                  TEXT,
      expiration_date         TEXT,
      stock_type              TEXT,
      creation_equity_num     TEXT,
      contract_type           TEXT
    );

    COMMENT ON COLUMN accounter_schema.poalim_securities.security_key IS
      'Source field "-Key": Poalim''s security identifier, joins to AccountPosition.Balance.EquityNumber';

    COMMENT ON COLUMN accounter_schema.poalim_securities.currency_code IS
      'Kept as TEXT rather than accounter_schema.currency for source fidelity (JPY and others appear)';

    COMMENT ON COLUMN accounter_schema.poalim_securities.expiration_date IS
      'Source field is always null in observed data; kept TEXT rather than DATE until the format is known';

    ALTER TABLE accounter_schema.poalim_securities
      ENABLE ROW LEVEL SECURITY;

    ALTER TABLE accounter_schema.poalim_securities
      FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.poalim_securities
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    CREATE UNIQUE INDEX poalim_securities_dedup_uindex
      ON accounter_schema.poalim_securities (bank_number, branch_number, account_number, security_key)
      NULLS NOT DISTINCT;

    CREATE INDEX poalim_securities_owner_id_idx
      ON accounter_schema.poalim_securities (owner_id);
  `,
} satisfies MigrationExecutor;
