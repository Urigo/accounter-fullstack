import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Stores, per charge, the values the charges list sorts and filters by.
 *
 * The list query (`getChargesByFilters` in the server's charges provider) derives those values from
 * a charge's transactions, documents, ledger records, misc expenses and securities executions. It
 * therefore aggregates every charge of the business before it can sort and cut one page out of
 * them. With the values stored, a list can pick its page from this table and run the heavy
 * aggregates for that page alone.
 *
 * This migration only adds the table and keeps it current. Nothing reads it yet.
 *
 * - Every expression in `refresh_charge_list_facts` is taken from the list query. The two must
 *   agree, which `charge-list-facts.integration.test.ts` in the server package checks.
 * - Statement-level triggers refresh the charges a statement touched, once per statement rather
 *   than once per row, so a bulk insert pays for one refresh.
 * - A refresh only writes rows of the business the session writes for, as the row-level security
 *   of every source table already demands of the write that fired it. A charge of another business
 *   in scope is left as it is. A session with no business context (a migration, or a role that
 *   bypasses row-level security) refreshes whatever it was asked to.
 * - A charge's values come from rows of the charge's own business only, which is what a session
 *   of that business can see. So the stored values do not depend on who refreshed them: a
 *   migration with no business context stores the same as the business's own session would.
 * - Not tracked: a change to the dates of a securities execution that a charge books directly, and
 *   the removal of a business that was a charge's only counterparty. Both are rare and the next
 *   write to the charge corrects them.
 *
 * The backfill reads tables that hide every row from a session with no business context, so it
 * lifts FORCE ROW LEVEL SECURITY from them for its own transaction, as
 * `2026-10-15T14-00-00.poalim-securities-transactions-restatable-dedup` did.
 */
export default {
  name: '2026-11-25T10-00-00.charge-list-facts.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.charge_list_facts (
      charge_id                 UUID        NOT NULL
                                            CONSTRAINT charge_list_facts_pk PRIMARY KEY
                                            CONSTRAINT charge_list_facts_charge_id_fk
                                              REFERENCES accounter_schema.charges (id) ON DELETE CASCADE,
      owner_id                  UUID        NOT NULL,
      sort_date                 DATE,
      sort_date_tiebreak        DATE,
      event_amount              NUMERIC,
      transactions_event_amount NUMERIC,
      main_min_date             DATE,
      main_max_date             DATE,
      any_min_date              DATE,
      any_max_date              DATE,
      invoices_count            INTEGER     NOT NULL DEFAULT 0,
      receipts_count            INTEGER     NOT NULL DEFAULT 0,
      documents_count           INTEGER     NOT NULL DEFAULT 0,
      transactions_count        INTEGER     NOT NULL DEFAULT 0,
      ledger_count              INTEGER     NOT NULL DEFAULT 0,
      has_open_documents        BOOLEAN     NOT NULL DEFAULT FALSE,
      missing_counterparty      BOOLEAN     NOT NULL DEFAULT FALSE,
      business_ids              UUID[],
      main_business_id          UUID,
      account_ids               UUID[],
      refreshed_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    COMMENT ON TABLE accounter_schema.charge_list_facts IS
      'Per charge, the values the charges list sorts and filters by, refreshed by triggers on the tables they are derived from';

    CREATE INDEX IF NOT EXISTS charge_list_facts_owner_sort_date_idx
      ON accounter_schema.charge_list_facts (owner_id, sort_date, sort_date_tiebreak, charge_id);

    -- Ledger records had no index that finds them by charge (the existing one leads with id), so
    -- a refresh of one charge read every ledger record of the business.
    CREATE INDEX IF NOT EXISTS ledger_records_charge_id_idx
      ON accounter_schema.ledger_records (charge_id);

    ALTER TABLE accounter_schema.charge_list_facts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.charge_list_facts FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.charge_list_facts;
    CREATE POLICY tenant_isolation ON accounter_schema.charge_list_facts
      FOR ALL
      USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.charge_list_facts;
    CREATE POLICY tenant_isolation_delete ON accounter_schema.charge_list_facts
      AS RESTRICTIVE
      FOR DELETE
      USING (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_update ON accounter_schema.charge_list_facts;
    CREATE POLICY tenant_isolation_update ON accounter_schema.charge_list_facts
      AS RESTRICTIVE
      FOR UPDATE
      USING (owner_id = accounter_schema.get_current_business_id());

    CREATE OR REPLACE FUNCTION accounter_schema.refresh_charge_list_facts(p_charge_ids UUID[])
      RETURNS void
      LANGUAGE plpgsql
    AS $$
    BEGIN
      -- Nothing to do is the common case for a statement that touched no charge.
      IF p_charge_ids IS NULL OR cardinality(p_charge_ids) = 0 THEN
        RETURN;
      END IF;

      WITH target AS (
        SELECT c.id, c.owner_id
        FROM accounter_schema.charges c
        WHERE c.id = ANY (p_charge_ids)
          AND c.owner_id IS NOT NULL
          AND (
            NULLIF(current_setting('app.current_business_id', true), '') IS NULL
            OR c.owner_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid
          )
      ),
      transactions_by_charge AS (
        SELECT t.charge_id,
               min(t.event_date) AS min_event_date,
               max(t.event_date) AS max_event_date,
               min(COALESCE(t.debit_date_override, t.debit_date)) AS min_debit_date,
               max(COALESCE(t.debit_date_override, t.debit_date)) AS max_debit_date,
               sum(t.amount) AS event_amount,
               count(*) AS transactions_count,
               count(*) FILTER (WHERE t.business_id IS NULL) > 0 AS missing_counterparty,
               array_agg(DISTINCT t.account_id) AS account_array
        FROM accounter_schema.transactions t
        JOIN target ON target.id = t.charge_id AND target.owner_id = t.owner_id
        GROUP BY t.charge_id
      ),
      documents_by_charge AS (
        SELECT d.charge_id,
               COALESCE(
                 min(d.date) FILTER (WHERE d.type IN ('INVOICE', 'INVOICE_RECEIPT', 'RECEIPT', 'CREDIT_INVOICE')),
                 min(d.date)
               ) AS min_date,
               COALESCE(
                 max(d.date) FILTER (WHERE d.type IN ('INVOICE', 'INVOICE_RECEIPT', 'RECEIPT', 'CREDIT_INVOICE')),
                 max(d.date)
               ) AS max_date,
               count(*) FILTER (WHERE d.type IN ('INVOICE', 'INVOICE_RECEIPT', 'CREDIT_INVOICE')) AS invoices_count,
               count(*) FILTER (WHERE d.type IN ('RECEIPT', 'INVOICE_RECEIPT')) AS receipts_count,
               count(*) AS documents_count,
               sum(d.total_amount * CASE WHEN d.debtor_id = target.owner_id THEN -1 ELSE 1 END::double precision)
                 FILTER (WHERE d.type IN ('INVOICE', 'INVOICE_RECEIPT', 'CREDIT_INVOICE')) AS invoice_amount,
               sum(d.total_amount * CASE WHEN d.debtor_id = target.owner_id THEN -1 ELSE 1 END::double precision)
                 FILTER (WHERE d.type IN ('RECEIPT', 'INVOICE_RECEIPT')) AS receipt_amount,
               sum(d.total_amount * CASE WHEN d.debtor_id = target.owner_id THEN -1 ELSE 1 END::double precision)
                 FILTER (WHERE d.type = 'PROFORMA') AS proforma_amount,
               count(*) FILTER (
                 WHERE d.type IN ('INVOICE', 'INVOICE_RECEIPT', 'RECEIPT', 'CREDIT_INVOICE')
                   AND (d.creditor_id IS NULL OR d.debtor_id IS NULL)
               ) > 0 AS missing_counterparty,
               COALESCE(bool_or(doc_issued.status = 'OPEN'), false) AS has_open_documents
        FROM accounter_schema.documents d
        JOIN target ON target.id = d.charge_id AND target.owner_id = d.owner_id
        LEFT JOIN accounter_schema.documents_issued doc_issued
          ON d.id = doc_issued.id AND doc_issued.owner_id = d.owner_id
        GROUP BY d.charge_id
      ),
      ledger_by_charge AS (
        SELECT lr.charge_id,
               count(*) AS ledger_count,
               min(lr.value_date) AS min_value_date,
               max(lr.value_date) AS max_value_date,
               min(lr.invoice_date) AS min_invoice_date,
               max(lr.invoice_date) AS max_invoice_date
        FROM accounter_schema.ledger_records lr
        JOIN target ON target.id = lr.charge_id AND target.owner_id = lr.owner_id
        GROUP BY lr.charge_id
      ),
      securities_executions_by_charge AS (
        SELECT cse.charge_id,
               min(COALESCE(pst.value_date, pst.trade_date)) AS min_date,
               max(COALESCE(pst.value_date, pst.trade_date)) AS max_date
        FROM accounter_schema.charges_securities_executions cse
        JOIN target ON target.id = cse.charge_id AND target.owner_id = cse.owner_id
        JOIN accounter_schema.poalim_securities_transactions pst
          ON pst.id = cse.execution_id AND pst.owner_id = cse.owner_id
        GROUP BY cse.charge_id
      ),
      -- Every party of the charge, and the ones that can be its main counterparty: a document's
      -- two sides and a transaction that is not a fee.
      parties AS (
        SELECT t.charge_id, t.business_id, COALESCE(t.is_fee, false) AS is_fee
        FROM accounter_schema.transactions t
        JOIN target ON target.id = t.charge_id AND target.owner_id = t.owner_id
        WHERE t.business_id IS NOT NULL
        UNION
        SELECT d.charge_id, side.business_id, false
        FROM accounter_schema.documents d
        JOIN target ON target.id = d.charge_id AND target.owner_id = d.owner_id
        CROSS JOIN LATERAL (VALUES (d.creditor_id), (d.debtor_id)) AS side (business_id)
        WHERE side.business_id IS NOT NULL
        UNION
        SELECT lr.charge_id, side.business_id, true
        FROM accounter_schema.ledger_records lr
        JOIN target ON target.id = lr.charge_id AND target.owner_id = lr.owner_id
        CROSS JOIN LATERAL (
          VALUES (lr.credit_entity1), (lr.credit_entity2), (lr.debit_entity1), (lr.debit_entity2)
        ) AS side (business_id)
        WHERE side.business_id IS NOT NULL
        UNION
        SELECT me.charge_id, side.business_id, true
        FROM accounter_schema.misc_expenses me
        JOIN target ON target.id = me.charge_id AND target.owner_id = me.owner_id
        CROSS JOIN LATERAL (VALUES (me.creditor_id), (me.debtor_id)) AS side (business_id)
        WHERE side.business_id IS NOT NULL
      ),
      businesses_by_charge AS (
        SELECT p.charge_id,
               array_agg(DISTINCT p.business_id) AS business_array,
               array_agg(DISTINCT p.business_id) FILTER (WHERE NOT p.is_fee) AS main_business_array
        FROM parties p
        JOIN target ON target.id = p.charge_id
        WHERE p.business_id <> target.owner_id
        GROUP BY p.charge_id
      )
      INSERT INTO accounter_schema.charge_list_facts AS f (
        charge_id, owner_id, sort_date, sort_date_tiebreak, event_amount, transactions_event_amount,
        main_min_date, main_max_date, any_min_date, any_max_date,
        invoices_count, receipts_count, documents_count, transactions_count, ledger_count,
        has_open_documents, missing_counterparty, business_ids, main_business_id, account_ids,
        refreshed_at
      )
      SELECT
        c.id,
        c.owner_id,
        COALESCE(tbc.min_debit_date, tbc.min_event_date, dbc.min_date, lbc.min_value_date, lbc.min_invoice_date, sebc.min_date),
        COALESCE(dbc.min_date, tbc.min_event_date),
        COALESCE(
          CASE
            WHEN dbc.invoices_count > 0 THEN dbc.invoice_amount
            WHEN dbc.receipts_count > 0 THEN dbc.receipt_amount
            ELSE dbc.proforma_amount
          END::numeric,
          tbc.event_amount
        ),
        tbc.event_amount,
        COALESCE(dbc.min_date, tbc.min_event_date, sebc.min_date),
        COALESCE(dbc.max_date, tbc.max_event_date, sebc.max_date),
        LEAST(dbc.min_date, tbc.min_event_date, tbc.min_debit_date, lbc.min_invoice_date, lbc.min_value_date, sebc.min_date),
        GREATEST(dbc.max_date, tbc.max_event_date, tbc.max_debit_date, lbc.max_invoice_date, lbc.max_value_date, sebc.max_date),
        COALESCE(dbc.invoices_count, 0),
        COALESCE(dbc.receipts_count, 0),
        COALESCE(dbc.documents_count, 0),
        COALESCE(tbc.transactions_count, 0),
        COALESCE(lbc.ledger_count, 0),
        COALESCE(dbc.has_open_documents, false),
        COALESCE(tbc.missing_counterparty, false) OR COALESCE(dbc.missing_counterparty, false),
        bbc.business_array,
        b.id,
        tbc.account_array,
        now()
      FROM target c
      LEFT JOIN transactions_by_charge tbc ON tbc.charge_id = c.id
      LEFT JOIN documents_by_charge dbc ON dbc.charge_id = c.id
      LEFT JOIN ledger_by_charge lbc ON lbc.charge_id = c.id
      LEFT JOIN securities_executions_by_charge sebc ON sebc.charge_id = c.id
      LEFT JOIN businesses_by_charge bbc ON bbc.charge_id = c.id
      LEFT JOIN accounter_schema.businesses b
        ON b.id = bbc.main_business_array[1]
        AND array_length(bbc.main_business_array, 1) = 1
        AND b.owner_id = c.owner_id
      ON CONFLICT (charge_id) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        sort_date = EXCLUDED.sort_date,
        sort_date_tiebreak = EXCLUDED.sort_date_tiebreak,
        event_amount = EXCLUDED.event_amount,
        transactions_event_amount = EXCLUDED.transactions_event_amount,
        main_min_date = EXCLUDED.main_min_date,
        main_max_date = EXCLUDED.main_max_date,
        any_min_date = EXCLUDED.any_min_date,
        any_max_date = EXCLUDED.any_max_date,
        invoices_count = EXCLUDED.invoices_count,
        receipts_count = EXCLUDED.receipts_count,
        documents_count = EXCLUDED.documents_count,
        transactions_count = EXCLUDED.transactions_count,
        ledger_count = EXCLUDED.ledger_count,
        has_open_documents = EXCLUDED.has_open_documents,
        missing_counterparty = EXCLUDED.missing_counterparty,
        business_ids = EXCLUDED.business_ids,
        main_business_id = EXCLUDED.main_business_id,
        account_ids = EXCLUDED.account_ids,
        refreshed_at = EXCLUDED.refreshed_at;
    END;
    $$;

    COMMENT ON FUNCTION accounter_schema.refresh_charge_list_facts(UUID[]) IS
      'Recomputes charge_list_facts for the given charges, from the same expressions the charges list query uses';

    -- One function per transition-table shape: an INSERT has only new rows, a DELETE only old
    -- ones, an UPDATE both (a row that moved to another charge changes both charges).
    CREATE OR REPLACE FUNCTION accounter_schema.charge_list_facts_after_insert()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM accounter_schema.refresh_charge_list_facts(
        ARRAY(SELECT DISTINCT n.charge_id FROM new_rows n WHERE n.charge_id IS NOT NULL)
      );
      RETURN NULL;
    END;
    $$;

    CREATE OR REPLACE FUNCTION accounter_schema.charge_list_facts_after_delete()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM accounter_schema.refresh_charge_list_facts(
        ARRAY(SELECT DISTINCT o.charge_id FROM old_rows o WHERE o.charge_id IS NOT NULL)
      );
      RETURN NULL;
    END;
    $$;

    CREATE OR REPLACE FUNCTION accounter_schema.charge_list_facts_after_update()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM accounter_schema.refresh_charge_list_facts(
        ARRAY(
          SELECT n.charge_id FROM new_rows n WHERE n.charge_id IS NOT NULL
          UNION
          SELECT o.charge_id FROM old_rows o WHERE o.charge_id IS NOT NULL
        )
      );
      RETURN NULL;
    END;
    $$;

    -- documents_issued carries the open/closed status of a document and shares its id.
    CREATE OR REPLACE FUNCTION accounter_schema.charge_list_facts_after_issued_document_change()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM accounter_schema.refresh_charge_list_facts(
          ARRAY(
            SELECT DISTINCT d.charge_id
            FROM new_rows n
            JOIN accounter_schema.documents d ON d.id = n.id
            WHERE d.charge_id IS NOT NULL
          )
        );
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM accounter_schema.refresh_charge_list_facts(
          ARRAY(
            SELECT DISTINCT d.charge_id
            FROM old_rows o
            JOIN accounter_schema.documents d ON d.id = o.id
            WHERE d.charge_id IS NOT NULL
          )
        );
      ELSE
        PERFORM accounter_schema.refresh_charge_list_facts(
          ARRAY(
            SELECT DISTINCT d.charge_id
            FROM (SELECT n.id FROM new_rows n UNION SELECT o.id FROM old_rows o) changed
            JOIN accounter_schema.documents d ON d.id = changed.id
            WHERE d.charge_id IS NOT NULL
          )
        );
      END IF;
      RETURN NULL;
    END;
    $$;

    -- A new charge gets its row at once, so a list never has to treat a missing row.
    CREATE OR REPLACE FUNCTION accounter_schema.charge_list_facts_after_charge_insert()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM accounter_schema.refresh_charge_list_facts(ARRAY(SELECT n.id FROM new_rows n));
      RETURN NULL;
    END;
    $$;

    CREATE OR REPLACE FUNCTION accounter_schema.charge_list_facts_after_charge_owner_change()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM accounter_schema.refresh_charge_list_facts(ARRAY[NEW.id]);
      RETURN NULL;
    END;
    $$;

    DO $$
    DECLARE
      source_table TEXT;
    BEGIN
      FOREACH source_table IN ARRAY ARRAY[
        'transactions', 'documents', 'ledger_records', 'misc_expenses', 'charges_securities_executions'
      ]
      LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS charge_list_facts_insert ON accounter_schema.%I', source_table);
        EXECUTE format('DROP TRIGGER IF EXISTS charge_list_facts_update ON accounter_schema.%I', source_table);
        EXECUTE format('DROP TRIGGER IF EXISTS charge_list_facts_delete ON accounter_schema.%I', source_table);
        EXECUTE format(
          'CREATE TRIGGER charge_list_facts_insert AFTER INSERT ON accounter_schema.%I
             REFERENCING NEW TABLE AS new_rows
             FOR EACH STATEMENT EXECUTE FUNCTION accounter_schema.charge_list_facts_after_insert()',
          source_table
        );
        EXECUTE format(
          'CREATE TRIGGER charge_list_facts_update AFTER UPDATE ON accounter_schema.%I
             REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
             FOR EACH STATEMENT EXECUTE FUNCTION accounter_schema.charge_list_facts_after_update()',
          source_table
        );
        EXECUTE format(
          'CREATE TRIGGER charge_list_facts_delete AFTER DELETE ON accounter_schema.%I
             REFERENCING OLD TABLE AS old_rows
             FOR EACH STATEMENT EXECUTE FUNCTION accounter_schema.charge_list_facts_after_delete()',
          source_table
        );
      END LOOP;
    END;
    $$;

    DROP TRIGGER IF EXISTS charge_list_facts_insert ON accounter_schema.documents_issued;
    CREATE TRIGGER charge_list_facts_insert AFTER INSERT ON accounter_schema.documents_issued
      REFERENCING NEW TABLE AS new_rows
      FOR EACH STATEMENT EXECUTE FUNCTION accounter_schema.charge_list_facts_after_issued_document_change();

    DROP TRIGGER IF EXISTS charge_list_facts_update ON accounter_schema.documents_issued;
    CREATE TRIGGER charge_list_facts_update AFTER UPDATE ON accounter_schema.documents_issued
      REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
      FOR EACH STATEMENT EXECUTE FUNCTION accounter_schema.charge_list_facts_after_issued_document_change();

    DROP TRIGGER IF EXISTS charge_list_facts_delete ON accounter_schema.documents_issued;
    CREATE TRIGGER charge_list_facts_delete AFTER DELETE ON accounter_schema.documents_issued
      REFERENCING OLD TABLE AS old_rows
      FOR EACH STATEMENT EXECUTE FUNCTION accounter_schema.charge_list_facts_after_issued_document_change();

    DROP TRIGGER IF EXISTS charge_list_facts_insert ON accounter_schema.charges;
    CREATE TRIGGER charge_list_facts_insert AFTER INSERT ON accounter_schema.charges
      REFERENCING NEW TABLE AS new_rows
      FOR EACH STATEMENT EXECUTE FUNCTION accounter_schema.charge_list_facts_after_charge_insert();

    DROP TRIGGER IF EXISTS charge_list_facts_owner_change ON accounter_schema.charges;
    CREATE TRIGGER charge_list_facts_owner_change AFTER UPDATE OF owner_id ON accounter_schema.charges
      FOR EACH ROW
      WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
      EXECUTE FUNCTION accounter_schema.charge_list_facts_after_charge_owner_change();

    -- Backfill. With no business context, FORCE ROW LEVEL SECURITY hides every row (the policies
    -- raise), so lift it from the tables the refresh touches and put it back before the end.
    DO $$
    DECLARE
      forced_tables TEXT[];
      forced_table TEXT;
    BEGIN
      SELECT array_agg(c.relname::text)
      INTO forced_tables
      FROM pg_class c
      WHERE c.relnamespace = 'accounter_schema'::regnamespace
        AND c.relforcerowsecurity
        AND c.relname IN (
          'charges', 'transactions', 'documents', 'documents_issued', 'businesses', 'ledger_records',
          'misc_expenses', 'charges_securities_executions', 'poalim_securities_transactions',
          'charge_list_facts'
        );

      FOREACH forced_table IN ARRAY COALESCE(forced_tables, ARRAY[]::TEXT[])
      LOOP
        EXECUTE format('ALTER TABLE accounter_schema.%I NO FORCE ROW LEVEL SECURITY', forced_table);
      END LOOP;

      PERFORM accounter_schema.refresh_charge_list_facts(
        ARRAY(SELECT c.id FROM accounter_schema.charges c)
      );

      FOREACH forced_table IN ARRAY COALESCE(forced_tables, ARRAY[]::TEXT[])
      LOOP
        EXECUTE format('ALTER TABLE accounter_schema.%I FORCE ROW LEVEL SECURITY', forced_table);
      END LOOP;
    END;
    $$;
  `,
} satisfies MigrationExecutor;
