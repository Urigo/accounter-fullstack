import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Add a GIN trigram index on accounter_schema.financial_entities.name.
 *
 * The charge free-text filter matches counterparty names with a leading-wildcard ILIKE
 * in six branches of the search_matches / excluded_matches CTEs (charges.provider.ts).
 * The pre-existing financial_entities_name_index is a plain btree, which cannot serve
 * '%...%' patterns, so those branches fell back to a sequential scan. pg_trgm is already
 * installed by 2026-03-23T12-00-00.index-search-strings.sql.
 *
 * The existing btree is kept: it still serves equality, prefix and ordering lookups.
 */
export default {
  name: '2026-08-31T11-00-00.index-financial-entity-names.sql',
  // CREATE INDEX CONCURRENTLY cannot run inside a transaction block, so this migration
  // opts out of the wrapping transaction. In exchange, building the index does not hold
  // an ACCESS EXCLUSIVE lock on financial_entities while production writes continue.
  noTransaction: true,
  run: async ({ connection }) => {
    // A CONCURRENTLY build that fails part-way (deadlock, cancelled statement, dropped
    // connection) leaves the index behind with indisvalid = false. The planner ignores
    // such an index, but IF NOT EXISTS below matches on name alone and would silently
    // no-op on the retry -- recording this migration as applied while the index stays
    // unusable. So drop an invalid leftover first. NOT indisvalid also covers the
    // mirror case of a failed DROP INDEX CONCURRENTLY (indisvalid and indisready both
    // false); either way the index has to be rebuilt.
    const hasInvalidIndex = await connection.maybeOneFirst(sql.unsafe`
      SELECT true
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'accounter_schema'
        AND c.relname = 'idx_financial_entities_name_trgm'
        AND NOT i.indisvalid
    `);

    // Conditional on purpose: an unconditional drop would tear down and rebuild a
    // perfectly good index every time the migration history is replayed.
    if (hasInvalidIndex === true) {
      await connection.query(sql.unsafe`
        DROP INDEX CONCURRENTLY IF EXISTS accounter_schema.idx_financial_entities_name_trgm
      `);
    }

    await connection.query(sql.unsafe`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_entities_name_trgm
        ON accounter_schema.financial_entities USING gin (name gin_trgm_ops)
    `);
  },
} satisfies MigrationExecutor;
