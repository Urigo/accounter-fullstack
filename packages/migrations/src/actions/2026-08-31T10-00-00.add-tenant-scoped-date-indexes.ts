import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-31T10-00-00.add-tenant-scoped-date-indexes.sql',
  // CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and each statement has to be
  // issued on its own, so this migration opts out of the default per-migration transaction.
  noTransaction: true,
  run: async ({ connection }) => {
    // Date-range filters on transactions/documents used to be written as
    // `<col>::TEXT::DATE >= date_trunc('day', $param ::DATE)`. The text round-trip made the
    // predicate non-sargable, so no index could serve it and the planner lost the column
    // statistics. Now that the casts are gone, back those filters with indexes.
    //
    // Every read is tenant-scoped through RLS on owner_id, so these are composite
    // (owner_id, <date>) rather than plain date indexes: one index serves both the tenant
    // predicate and the range. The COALESCE variants match the "effective" date the filters
    // actually compare against; COALESCE over two date columns is immutable, so it is a legal
    // index expression (the old ::TEXT::DATE form was not, date_in/date_out being stable).

    await connection.query(sql.unsafe`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_owner_event_date
        ON accounter_schema.transactions (owner_id, event_date)
    `);

    await connection.query(sql.unsafe`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_owner_effective_debit_date
        ON accounter_schema.transactions (owner_id, (COALESCE(debit_date_override, debit_date)))
    `);

    await connection.query(sql.unsafe`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_owner_date
        ON accounter_schema.documents (owner_id, date)
    `);

    await connection.query(sql.unsafe`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_owner_vat_report_date
        ON accounter_schema.documents (owner_id, (COALESCE(vat_report_date_override, date)))
    `);
  },
} satisfies MigrationExecutor;
