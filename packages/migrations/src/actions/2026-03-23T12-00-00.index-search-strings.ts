import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-23T12-00-00.index-search-strings.sql',
  run: ({ sql }) => sql`
    -- Run once to enable the extension
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- Create GIN indexes on the source columns used in your search
    CREATE INDEX IF NOT EXISTS idx_charges_desc_trgm ON accounter_schema.charges USING gin (user_description gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_trans_src_trgm ON accounter_schema.transactions USING gin (source_description gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_trans_src_ref_trgm ON accounter_schema.transactions USING gin (source_reference gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_docs_desc_trgm ON accounter_schema.documents USING gin (description gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_docs_remarks_trgm ON accounter_schema.documents USING gin (remarks gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_docs_serial_trgm ON accounter_schema.documents USING gin (serial_number gin_trgm_ops);
  `,
} satisfies MigrationExecutor;
