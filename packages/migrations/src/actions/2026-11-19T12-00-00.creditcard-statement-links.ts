import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Bank ⇄ credit card linkage, phase 1: the model.
 *
 * A card "statement" (billing cycle) is not stored. It is derived from the card's transactions as
 * `(card account, currency, COALESCE(debit_date_override, debit_date))`, so card rows that arrive
 * late join their statement without any write.
 *
 * - `financial_credit_card_accounts` is the CREDIT_CARD side table, mirroring
 *   `financial_bank_accounts`: one optional row per card account. `settlement_account_id` is the
 *   bank account the card is debited from. A card account without a row has no settlement account
 *   (readers LEFT JOIN, writers upsert), so the table starts empty.
 * - `creditcard_statement_links` is the stored edge between a bank debit and the statement(s) it
 *   settles. One bank debit can settle several statements (a combined debit), but a statement is
 *   settled once: `UNIQUE (card_account_id, currency, debit_date)`. Deleting the bank transaction
 *   or the card account drops its links.
 * - `creditcard_statement_link_rejections` records a link a user removed, so neither the automation
 *   nor the read-time matcher proposes it again for that bank transaction. Linking the statement
 *   again by hand deletes the rejection.
 *
 * All three tables carry `owner_id` and get the same RLS policies as
 * `2026-09-28T10-30-00.rls-dynamic-report-comments.ts`: reads follow the request's authorized
 * scope, writes are pinned to the single write target, and the RESTRICTIVE per-command policies
 * keep DELETE and UPDATE on the write target. FORCE makes them apply to the table owner too.
 */
export default {
  name: '2026-11-19T12-00-00.creditcard-statement-links.sql',
  run: ({ sql }) => sql`
DO $$
BEGIN
  CREATE TYPE accounter_schema.creditcard_statement_link_method AS ENUM ('REFERENCE', 'AMOUNT', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS accounter_schema.financial_credit_card_accounts
(
    id                    uuid                      NOT NULL
        CONSTRAINT financial_credit_card_accounts_pk PRIMARY KEY
        CONSTRAINT fk_financial_credit_card_accounts_id
            REFERENCES accounter_schema.financial_accounts (id)
            ON UPDATE CASCADE ON DELETE CASCADE,
    owner_id              uuid                      NOT NULL
        CONSTRAINT fk_financial_credit_card_accounts_owner_id
            REFERENCES accounter_schema.businesses (id),
    settlement_account_id uuid
        CONSTRAINT fk_financial_credit_card_accounts_settlement_account_id
            REFERENCES accounter_schema.financial_accounts (id)
            ON DELETE SET NULL,
    created_at            timestamptz DEFAULT now() NOT NULL,
    updated_at            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_credit_card_accounts_owner_id
    ON accounter_schema.financial_credit_card_accounts (owner_id);

DROP TRIGGER IF EXISTS update_financial_credit_card_accounts_updated_at
    ON accounter_schema.financial_credit_card_accounts;
CREATE TRIGGER update_financial_credit_card_accounts_updated_at
    BEFORE UPDATE
    ON accounter_schema.financial_credit_card_accounts
    FOR EACH ROW
EXECUTE FUNCTION accounter_schema.update_general_updated_at();

CREATE TABLE IF NOT EXISTS accounter_schema.creditcard_statement_links
(
    id                  uuid DEFAULT uuidv7()                                     NOT NULL
        CONSTRAINT creditcard_statement_links_pk PRIMARY KEY,
    owner_id            uuid                                                      NOT NULL
        CONSTRAINT fk_creditcard_statement_links_owner_id
            REFERENCES accounter_schema.businesses (id),
    bank_transaction_id uuid                                                      NOT NULL
        CONSTRAINT fk_creditcard_statement_links_bank_transaction_id
            REFERENCES accounter_schema.transactions (id)
            ON DELETE CASCADE,
    card_account_id     uuid                                                      NOT NULL
        CONSTRAINT fk_creditcard_statement_links_card_account_id
            REFERENCES accounter_schema.financial_accounts (id)
            ON DELETE CASCADE,
    currency            accounter_schema.currency                                 NOT NULL,
    debit_date          date                                                      NOT NULL,
    link_method         accounter_schema.creditcard_statement_link_method         NOT NULL,
    created_at          timestamptz DEFAULT now()                                 NOT NULL,
    CONSTRAINT creditcard_statement_links_statement_unique
        UNIQUE (card_account_id, currency, debit_date)
);

CREATE INDEX IF NOT EXISTS idx_creditcard_statement_links_bank_transaction_id
    ON accounter_schema.creditcard_statement_links (bank_transaction_id);

CREATE INDEX IF NOT EXISTS idx_creditcard_statement_links_owner_id
    ON accounter_schema.creditcard_statement_links (owner_id);

CREATE TABLE IF NOT EXISTS accounter_schema.creditcard_statement_link_rejections
(
    id                  uuid DEFAULT uuidv7()      NOT NULL
        CONSTRAINT creditcard_statement_link_rejections_pk PRIMARY KEY,
    owner_id            uuid                       NOT NULL
        CONSTRAINT fk_creditcard_statement_link_rejections_owner_id
            REFERENCES accounter_schema.businesses (id),
    bank_transaction_id uuid                       NOT NULL
        CONSTRAINT fk_creditcard_statement_link_rejections_bank_transaction_id
            REFERENCES accounter_schema.transactions (id)
            ON DELETE CASCADE,
    card_account_id     uuid                       NOT NULL
        CONSTRAINT fk_creditcard_statement_link_rejections_card_account_id
            REFERENCES accounter_schema.financial_accounts (id)
            ON DELETE CASCADE,
    currency            accounter_schema.currency  NOT NULL,
    debit_date          date                       NOT NULL,
    created_at          timestamptz DEFAULT now()  NOT NULL,
    CONSTRAINT creditcard_statement_link_rejections_unique
        UNIQUE (bank_transaction_id, card_account_id, currency, debit_date)
);

CREATE INDEX IF NOT EXISTS idx_creditcard_statement_link_rejections_owner_id
    ON accounter_schema.creditcard_statement_link_rejections (owner_id);

-- RLS: financial_credit_card_accounts
ALTER TABLE accounter_schema.financial_credit_card_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounter_schema.financial_credit_card_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.financial_credit_card_accounts;
CREATE POLICY tenant_isolation ON accounter_schema.financial_credit_card_accounts
    FOR ALL
    USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
    WITH CHECK (owner_id = accounter_schema.get_current_business_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.financial_credit_card_accounts;
CREATE POLICY tenant_isolation_delete ON accounter_schema.financial_credit_card_accounts
    AS RESTRICTIVE
    FOR DELETE
    USING (owner_id = accounter_schema.get_current_business_id());

DROP POLICY IF EXISTS tenant_isolation_update ON accounter_schema.financial_credit_card_accounts;
CREATE POLICY tenant_isolation_update ON accounter_schema.financial_credit_card_accounts
    AS RESTRICTIVE
    FOR UPDATE
    USING (owner_id = accounter_schema.get_current_business_id());

-- RLS: creditcard_statement_links
ALTER TABLE accounter_schema.creditcard_statement_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounter_schema.creditcard_statement_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.creditcard_statement_links;
CREATE POLICY tenant_isolation ON accounter_schema.creditcard_statement_links
    FOR ALL
    USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
    WITH CHECK (owner_id = accounter_schema.get_current_business_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.creditcard_statement_links;
CREATE POLICY tenant_isolation_delete ON accounter_schema.creditcard_statement_links
    AS RESTRICTIVE
    FOR DELETE
    USING (owner_id = accounter_schema.get_current_business_id());

DROP POLICY IF EXISTS tenant_isolation_update ON accounter_schema.creditcard_statement_links;
CREATE POLICY tenant_isolation_update ON accounter_schema.creditcard_statement_links
    AS RESTRICTIVE
    FOR UPDATE
    USING (owner_id = accounter_schema.get_current_business_id());

-- RLS: creditcard_statement_link_rejections
ALTER TABLE accounter_schema.creditcard_statement_link_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounter_schema.creditcard_statement_link_rejections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.creditcard_statement_link_rejections;
CREATE POLICY tenant_isolation ON accounter_schema.creditcard_statement_link_rejections
    FOR ALL
    USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
    WITH CHECK (owner_id = accounter_schema.get_current_business_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.creditcard_statement_link_rejections;
CREATE POLICY tenant_isolation_delete ON accounter_schema.creditcard_statement_link_rejections
    AS RESTRICTIVE
    FOR DELETE
    USING (owner_id = accounter_schema.get_current_business_id());

DROP POLICY IF EXISTS tenant_isolation_update ON accounter_schema.creditcard_statement_link_rejections;
CREATE POLICY tenant_isolation_update ON accounter_schema.creditcard_statement_link_rejections
    AS RESTRICTIVE
    FOR UPDATE
    USING (owner_id = accounter_schema.get_current_business_id());
`,
} satisfies MigrationExecutor;
