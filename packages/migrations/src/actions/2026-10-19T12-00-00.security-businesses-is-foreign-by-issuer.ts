import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Re-derives `businesses_securities.is_foreign`, which ingestion used to stamp `true` on every
 * security regardless of where it was issued — Israeli funds and bonds included.
 *
 * Same rule the server now applies on ingest (`isForeignSecurity`): foreign when the issuer
 * country is not IL, falling back to the ISIN's country prefix when the issuer country is not a
 * two-letter code. Rows where neither is readable are left untouched.
 */
export default {
  name: '2026-10-19T12-00-00.security-businesses-is-foreign-by-issuer.sql',
  run: async ({ connection }) => {
    // The backfill runs with no tenant session, so FORCE RLS would hide every row from it.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.businesses_securities NO FORCE ROW LEVEL SECURITY
    `);

    await connection.query(sql.unsafe`
      WITH derived AS (
        SELECT
          id,
          COALESCE(
            CASE WHEN upper(trim(issuer_country_code)) ~ '^[A-Z]{2}$'
              THEN upper(trim(issuer_country_code)) END,
            CASE WHEN upper(left(trim(isin), 2)) ~ '^[A-Z]{2}$'
              THEN upper(left(trim(isin), 2)) END
          ) AS country_code
        FROM accounter_schema.businesses_securities
      )
      UPDATE accounter_schema.businesses_securities bs
      SET is_foreign = derived.country_code <> 'IL'
      FROM derived
      WHERE bs.id = derived.id
        AND derived.country_code IS NOT NULL
        AND bs.is_foreign IS DISTINCT FROM (derived.country_code <> 'IL')
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.businesses_securities FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
