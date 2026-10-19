import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Re-derives `businesses_securities.is_foreign`, which ingestion used to stamp `true` on every
 * security regardless of where it was issued — Israeli funds and bonds included.
 *
 * Same rule the server now applies on ingest (`getSecurityLocality`): foreign when the issuer
 * country differs from the tenant's locality, falling back to the ISIN's country prefix when the
 * issuer country is not a two-letter code. Rows where neither is readable are left untouched.
 *
 * Only tenants whose locality is ISR are backfilled: the issuer country is alpha-2 while the
 * locality is alpha-3, and the database holds no mapping between the two. The only securities
 * source today is an Israeli bank; a tenant with any other locality has its flags corrected by its
 * next scrape, which now refreshes them.
 */
export default {
  name: '2026-10-19T12-00-00.security-businesses-is-foreign-by-issuer.sql',
  run: async ({ connection }) => {
    // The backfill runs with no tenant session, so FORCE RLS would hide every row from it.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.businesses_securities NO FORCE ROW LEVEL SECURITY
    `);
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context NO FORCE ROW LEVEL SECURITY
    `);

    await connection.query(sql.unsafe`
      WITH derived AS (
        SELECT
          bs.id,
          COALESCE(
            CASE WHEN upper(trim(bs.issuer_country_code)) ~ '^[A-Z]{2}$'
              THEN upper(trim(bs.issuer_country_code)) END,
            CASE WHEN upper(left(trim(bs.isin), 2)) ~ '^[A-Z]{2}$'
              THEN upper(left(trim(bs.isin), 2)) END
          ) AS country_code
        FROM accounter_schema.businesses_securities bs
        INNER JOIN accounter_schema.user_context uc
          ON uc.owner_id = bs.owner_id
        WHERE uc.locality = 'ISR'
      )
      UPDATE accounter_schema.businesses_securities bs
      SET is_foreign = derived.country_code <> 'IL'
      FROM derived
      WHERE bs.id = derived.id
        AND derived.country_code IS NOT NULL
        AND bs.is_foreign IS DISTINCT FROM (derived.country_code <> 'IL')
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context FORCE ROW LEVEL SECURITY
    `);
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.businesses_securities FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
