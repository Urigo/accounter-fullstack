import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Tenant-scope accounter_schema.poalim_securities (created in 2026-08-11T12-00-00).
 *
 * The table was created with a nullable owner_id and an owner-less dedup index. Both are
 * wrong for an RLS table: unique indexes are enforced regardless of RLS, so two tenants
 * holding the same security in identically-numbered accounts collide and the second
 * tenant's rows are silently dropped by ON CONFLICT DO NOTHING. A NULL owner_id row is
 * likewise unusable — the tenant_isolation policy makes it invisible to every tenant.
 *
 * Index changes:
 *   - DROP unique index poalim_securities_dedup_uindex (bank, branch, account, key)
 *   - ADD  unique index poalim_securities_dedup_uindex (owner_id, bank, branch, account, key)
 *   - KEEP poalim_securities_owner_id_idx
 */
export default {
  name: '2026-08-12T10-00-00.poalim-securities-tenant-scoped-dedup.sql',
  run: async ({ connection }) => {
    // Temporarily disable FORCE RLS so the DELETE and the SET NOT NULL validation scan
    // don't trigger get_current_business_id() with no session context.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities NO FORCE ROW LEVEL SECURITY
    `);

    // Owner-less rows are invisible under the tenant_isolation policy and cannot be
    // attributed after the fact; the table only ever holds re-scrapable reference data.
    await connection.query(sql.unsafe`
      DELETE FROM accounter_schema.poalim_securities WHERE owner_id IS NULL
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities ALTER COLUMN owner_id SET NOT NULL
    `);

    await connection.query(sql.unsafe`
      DROP INDEX IF EXISTS accounter_schema.poalim_securities_dedup_uindex
    `);

    await connection.query(sql.unsafe`
      CREATE UNIQUE INDEX poalim_securities_dedup_uindex
        ON accounter_schema.poalim_securities (owner_id, bank_number, branch_number, account_number, security_key)
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
