import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-20T10-00-00.add-security-businesses.sql',
  run: ({ sql }) => sql`
    -- A "security business": an ordinary business row that stands for one traded instrument,
    -- so a security can be a transaction's counterparty and own a page of its own.
    --
    -- Identity is the ISIN. The rest of the codebase addresses a security by Poalim's
    -- proprietary security key (accounter_schema.poalim_securities.security_key, parsed out of
    -- the transaction description), and that reference table carries no ISIN at all — the ISIN
    -- lives only on execution rows. accounter_schema.security_identifiers is the bridge, and is
    -- deliberately source-agnostic: a second broker is a new identifier_type, not a new column.
    --
    -- 1:1 extension of accounter_schema.businesses, same shape as businesses_admin / clients.
    CREATE TABLE accounter_schema.businesses_securities (
      id                 UUID        NOT NULL
                                     CONSTRAINT businesses_securities_pk PRIMARY KEY
                                     CONSTRAINT businesses_securities_businesses_id_fk
                                       REFERENCES accounter_schema.businesses (id) ON DELETE CASCADE,
      owner_id           UUID        NOT NULL
                                     CONSTRAINT businesses_securities_owner_id_fk
                                       REFERENCES accounter_schema.businesses (id) ON DELETE CASCADE,

      isin               TEXT        NOT NULL,

      -- Cached descriptors, copied from the ingested rows at creation time. Display only: the
      -- ingested tables stay the source of truth, this is what lets a business list render
      -- without joining the securities feed.
      symbol             TEXT,
      eng_name           TEXT,
      heb_name           TEXT,
      exchange           TEXT,
      currency_code      accounter_schema.currency,
      item_type          TEXT,
      stock_type         TEXT,
      is_etf             BOOLEAN,
      is_foreign         BOOLEAN,
      issuer_country_code TEXT,

      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    COMMENT ON TABLE accounter_schema.businesses_securities IS
      'Marks a business as standing for a single traded security; presence of a row is what makes it one';

    COMMENT ON COLUMN accounter_schema.businesses_securities.isin IS
      'The security''s identity. Sourced from accounter_schema.poalim_securities_transactions.isin';

    -- The closed type, unlike accounter_schema.poalim_securities.currency_code, which stays TEXT
    -- for source fidelity: this column is a resolved attribute of the business, not a verbatim
    -- copy of what a scrape reported, and the feeds spell their currencies inconsistently
    -- (Hebrew labels among them). Writers normalize through formatCurrency before inserting.
    COMMENT ON COLUMN accounter_schema.businesses_securities.currency_code IS
      'The currency the security trades in, normalized from the source label';

    CREATE UNIQUE INDEX businesses_securities_owner_isin_uindex
      ON accounter_schema.businesses_securities (owner_id, isin);

    CREATE INDEX businesses_securities_owner_id_idx
      ON accounter_schema.businesses_securities (owner_id);

    CREATE TRIGGER update_businesses_securities_updated_at
      BEFORE UPDATE ON accounter_schema.businesses_securities
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();

    ALTER TABLE accounter_schema.businesses_securities
      ENABLE ROW LEVEL SECURITY;

    ALTER TABLE accounter_schema.businesses_securities
      FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.businesses_securities
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    -- How every source names the security. POALIM_SECURITY_KEY is what the description parser
    -- and accounter_schema.poalim_securities_transactions.security carry; ISIN is stored too so
    -- one lookup path serves both. A new source is one ALTER TYPE ... ADD VALUE.
    CREATE TYPE accounter_schema.security_identifier_type AS ENUM (
      'POALIM_SECURITY_KEY',
      'ISIN'
    );

    CREATE TABLE accounter_schema.security_identifiers (
      id              UUID NOT NULL DEFAULT gen_random_uuid()
                           CONSTRAINT security_identifiers_pk PRIMARY KEY,
      owner_id        UUID NOT NULL
                           CONSTRAINT security_identifiers_owner_id_fk
                             REFERENCES accounter_schema.businesses (id) ON DELETE CASCADE,
      business_id     UUID NOT NULL
                           CONSTRAINT security_identifiers_businesses_securities_id_fk
                             REFERENCES accounter_schema.businesses_securities (id) ON DELETE CASCADE,
      identifier_type accounter_schema.security_identifier_type NOT NULL,
      identifier_value TEXT NOT NULL,

      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- One identifier resolves to exactly one security business; several identifiers may point at
    -- the same one, which is how two Poalim keys collapse into a single ISIN.
    CREATE UNIQUE INDEX security_identifiers_value_uindex
      ON accounter_schema.security_identifiers (owner_id, identifier_type, identifier_value);

    CREATE INDEX security_identifiers_business_id_idx
      ON accounter_schema.security_identifiers (owner_id, business_id);

    ALTER TABLE accounter_schema.security_identifiers
      ENABLE ROW LEVEL SECURITY;

    ALTER TABLE accounter_schema.security_identifiers
      FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.security_identifiers
      FOR ALL
      USING (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());
  `,
} satisfies MigrationExecutor;
