import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Change sort_codes primary key from (key) to (key, owner_id).
 *
 * Previously `key` was the sole PK (integer), which collides across tenants
 * because different businesses legitimately use the same key values. The
 * composite PK makes the uniqueness constraint per-tenant.
 *
 * Only financial_entities still has a sort_code column referencing sort_codes —
 * businesses and tax_categories dropped theirs in 2024-02-26. The FK on
 * financial_entities is dropped and re-added as a composite
 * (sort_code, owner_id) → sort_codes(key, owner_id).
 *
 * Index changes:
 *   - DROP unique index hash_sort_codes_key_uindex (key alone — no longer unique)
 *   - New composite PK btree index replaces the old single-column PK
 *   - KEEP idx_sort_codes_owner_id for lookups by owner
 *   - ADD idx_sort_codes_owner_key on (owner_id, key) for owner-first lookups
 */
export default {
  name: '2026-05-27T10-00-00.sort-codes-composite-pk.sql',
  run: async ({ connection }) => {
    // 1. Drop the FK on financial_entities that references the old single-column PK
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.financial_entities
        DROP CONSTRAINT IF EXISTS financial_entities_hash_sort_codes_key_fk
    `);

    // 2. Drop the old single-column unique index (redundant with the old PK,
    //    but explicitly defined in the initial migration)
    await connection.query(sql.unsafe`
      DROP INDEX IF EXISTS accounter_schema.hash_sort_codes_key_uindex
    `);

    // 3. Swap the primary key to the composite (key, owner_id)
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.sort_codes
        DROP CONSTRAINT hash_sort_codes_pk
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.sort_codes
        ADD CONSTRAINT sort_codes_pk PRIMARY KEY (key, owner_id)
    `);

    // 4. Add a covering index for the common (key, owner_id) lookup used by
    //    getSortCodesByIds queries that filter on key within a tenant context.
    //    The PK index already covers (key, owner_id), so add (owner_id, key)
    //    to support the owner-first lookup efficiently.
    await connection.query(sql.unsafe`
      CREATE INDEX IF NOT EXISTS idx_sort_codes_owner_key
        ON accounter_schema.sort_codes (owner_id, key)
    `);

    // 5. Re-add the FK as composite (sort_code, owner_id) → sort_codes(key, owner_id).
    //    financial_entities.owner_id is NOT NULL (added 2026-02-18), so the
    //    composite FK is valid and preserves referential integrity within each tenant.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.financial_entities
        ADD CONSTRAINT financial_entities_hash_sort_codes_key_fk
          FOREIGN KEY (sort_code, owner_id)
          REFERENCES accounter_schema.sort_codes (key, owner_id)
    `);
  },
} satisfies MigrationExecutor;
