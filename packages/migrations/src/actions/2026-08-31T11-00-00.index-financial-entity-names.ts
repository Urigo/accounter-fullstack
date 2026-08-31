import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-31T11-00-00.index-financial-entity-names.sql',
  // CREATE INDEX CONCURRENTLY cannot run inside a transaction block, so this migration
  // opts out of the wrapping transaction. In exchange, building the index does not hold
  // an ACCESS EXCLUSIVE lock on financial_entities while production writes continue.
  noTransaction: true,
  run: async ({ connection }) => {
    // financial_entities.name is searched with a leading-wildcard ILIKE from the charge
    // free-text filter (search_matches / excluded_matches in charges.provider.ts). The
    // pre-existing financial_entities_name_index is a plain btree, which cannot serve
    // '%...%' patterns, so those branches fell back to a sequential scan. pg_trgm is
    // already installed by 2026-03-23T12-00-00.index-search-strings.sql.
    await connection.query(
      sql.unsafe`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_entities_name_trgm ON accounter_schema.financial_entities USING gin (name gin_trgm_ops)`,
    );
  },
} satisfies MigrationExecutor;
