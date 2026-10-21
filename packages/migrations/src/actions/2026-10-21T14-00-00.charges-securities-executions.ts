import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Links a securities execution to the charge that books it, for executions with no cash leg of
 * their own.
 *
 * Every other execution reaches its charge through the bank transaction it pairs with (see
 * `match-security-executions.helper.ts`). A stock distribution — a dividend paid in shares — moves
 * no cash, so nothing pairs with it, and it would otherwise reach no charge and no ledger. Ingestion
 * creates a charge for each such execution and records the pair here; the ledger then books the
 * execution itself.
 *
 * One execution belongs to at most one charge, hence `execution_id` as the key. A charge can hold
 * several (after a merge).
 *
 * Execution rows are referenced from here on: `2026-10-15T14-00-00.poalim-securities-transactions-
 * restatable-dedup` deleted duplicate rows on the grounds that nothing referenced them, which is no
 * longer true. Deleting an execution drops its link (CASCADE) and leaves its charge without one.
 *
 * RLS follows `2026-08-23T10-00-00.rls-scope-securities-tables`: reads follow the request's
 * business scope, writes are pinned to the write target, and the restrictive per-command policies
 * keep DELETE and UPDATE from reaching another in-scope business's rows.
 */
export default {
  name: '2026-10-21T14-00-00.charges-securities-executions.sql',
  run: ({ sql }) => sql`
    CREATE TABLE accounter_schema.charges_securities_executions (
      execution_id UUID        NOT NULL
                               CONSTRAINT charges_securities_executions_pk PRIMARY KEY
                               CONSTRAINT charges_securities_executions_execution_id_fk
                                 REFERENCES accounter_schema.poalim_securities_transactions (id)
                                 ON DELETE CASCADE,
      charge_id    UUID        NOT NULL
                               CONSTRAINT charges_securities_executions_charge_id_fk
                                 REFERENCES accounter_schema.charges (id) ON DELETE CASCADE,
      owner_id     UUID        NOT NULL
                               CONSTRAINT charges_securities_executions_owner_id_fk
                                 REFERENCES accounter_schema.businesses (id) ON DELETE CASCADE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    COMMENT ON TABLE accounter_schema.charges_securities_executions IS
      'Securities executions booked by a charge directly, for executions with no cash leg (stock distributions)';

    CREATE INDEX charges_securities_executions_charge_id_idx
      ON accounter_schema.charges_securities_executions (charge_id);

    CREATE INDEX charges_securities_executions_owner_id_idx
      ON accounter_schema.charges_securities_executions (owner_id);

    ALTER TABLE accounter_schema.charges_securities_executions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.charges_securities_executions FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.charges_securities_executions
      FOR ALL
      USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    CREATE POLICY tenant_isolation_delete ON accounter_schema.charges_securities_executions
      AS RESTRICTIVE
      FOR DELETE
      USING (owner_id = accounter_schema.get_current_business_id());

    CREATE POLICY tenant_isolation_update ON accounter_schema.charges_securities_executions
      AS RESTRICTIVE
      FOR UPDATE
      USING (owner_id = accounter_schema.get_current_business_id());
  `,
} satisfies MigrationExecutor;
