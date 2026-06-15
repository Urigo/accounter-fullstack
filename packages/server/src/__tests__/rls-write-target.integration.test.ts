import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { TestDatabase } from './helpers/db-setup.js';
import { dropRlsRole, ensureRlsRole, runAsRlsRole } from './helpers/rls-role.js';

/**
 * Integration tests for the X-Business-Scope write-target logic.
 *
 * Verifies that `setRLSVariables` (TenantAwareDBClient) and
 * `applyRequestedReadScope` (AuthContextProvider) together produce the correct
 * `app.current_business_id` write-target for every combination of:
 *   - user memberships
 *   - X-Business-Scope header value
 *   - target owner_id for the insert
 *
 * Tests call `set_config` directly on the raw client — no TenantAwareDBClient
 * instance needed — exactly mirroring what setRLSVariables does at runtime.
 * The superuser connection bypasses RLS for fixture setup; RLS is exercised
 * only during the INSERT under test.
 */

// Three distinct tenant businesses used as test fixtures
const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// The non-superuser role used to test RLS enforcement (see helpers/rls-role.ts):
// the test pool connects as postgres (BYPASSRLS), so inserts as postgres always
// bypass RLS regardless of FORCE ROW LEVEL SECURITY. runAsRlsRole drops to a
// non-privileged role for the inserts-under-test so Postgres actually evaluates
// the WITH CHECK policy.
const SORT_CODES_GRANTS = [{ table: 'sort_codes', privileges: 'INSERT, SELECT' }];

/**
 * Mirrors the write-target and read-scope derivation from:
 *   - TenantAwareDBClient.setRLSVariables  (write-target selection)
 *   - AuthContextProvider.applyRequestedReadScope  (scope narrowing + validation)
 *
 * Returns null writeTarget when the context is invalid (no memberships, or
 * header references a business outside the membership list).
 */
function deriveRLSContext(
  memberships: string[], // ordered; first element = primary business
  scopeHeader: string[], // parsed X-Business-Scope; empty = absent
): { writeTarget: string | null; scopeArray: string } {
  if (memberships.length === 0) return { writeTarget: null, scopeArray: '' };

  const primary = memberships[0];

  if (scopeHeader.length > 0) {
    const allInMembership = scopeHeader.every(id => memberships.includes(id));
    if (!allInMembership) return { writeTarget: null, scopeArray: '' };
  }

  const activeScope = scopeHeader.length > 0 ? scopeHeader : memberships;

  // Single scoped business → use it as write-target (the core fix).
  // Multiple businesses in scope and primary is among them → use primary.
  // Multiple businesses in scope and primary is NOT among them → use first in
  // scope (primary is outside the active scope; writing to it would violate RLS).
  const writeTarget =
    activeScope.length === 1
      ? activeScope[0]
      : activeScope.includes(primary)
        ? primary
        : activeScope[0]; // primary outside scope → fall back to first scoped

  const scopeArray = `{${activeScope.map(id => `"${id}"`).join(',')}}`;
  return { writeTarget, scopeArray };
}

/** Attempt to insert a sort_code row under the given RLS context. */
async function attemptInsert(
  client: PoolClient,
  writeTarget: string | null,
  scopeArray: string,
  targetOwnerId: string,
  key: number,
): Promise<boolean> {
  if (writeTarget === null) return false;

  // Set session variables first (as superuser, before dropping privileges).
  await client.query(
    `SELECT set_config('app.current_business_id', $1, true),
            set_config('app.current_business_scope', $2, true)`,
    [writeTarget, scopeArray],
  );

  // Drop to a non-superuser role so Postgres actually evaluates the RLS
  // WITH CHECK policy (the pool connects as postgres, which has BYPASSRLS).
  try {
    return await runAsRlsRole(client, async () => {
      const result = await client.query(
        `INSERT INTO accounter_schema.sort_codes (key, name, owner_id)
         VALUES ($1, 'rls-test', $2)`,
        [key, targetOwnerId],
      );
      return (result.rowCount ?? 0) > 0;
    });
  } catch (err) {
    // 42501 = insufficient_privilege — the expected RLS WITH CHECK rejection.
    // Rethrow anything else so unexpected errors (bad SQL, missing table, etc.)
    // surface as real test failures rather than silent false negatives.
    if ((err as { code?: string }).code !== '42501') throw err;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Full test matrix
// Each row: [label, memberships, scopeHeader, insertTarget, shouldSucceed]
// ---------------------------------------------------------------------------
type MatrixRow = [
  label: string,
  memberships: string[],
  scopeHeader: string[],
  insertTarget: string,
  shouldSucceed: boolean,
];

const MATRIX: MatrixRow[] = [
  // ── No memberships ──────────────────────────────────────────────────────
  ['no-membership / no-header / insert-A', [], [], A, false],
  ['no-membership / no-header / insert-B', [], [], B, false],
  ['no-membership / header=[A] / insert-A', [], [A], A, false],

  // ── Single membership [A], no header ────────────────────────────────────
  ['[A] / no-header / insert-A', [A], [], A, true],
  ['[A] / no-header / insert-B', [A], [], B, false],
  ['[A] / no-header / insert-C', [A], [], C, false],

  // ── Single membership [A], header=[A] ───────────────────────────────────
  ['[A] / header=[A] / insert-A', [A], [A], A, true],
  ['[A] / header=[A] / insert-B', [A], [A], B, false],
  ['[A] / header=[A] / insert-C', [A], [A], C, false],

  // ── Single membership [A], header=[B] — B not in membership ─────────────
  ['[A] / header=[B] / insert-A', [A], [B], A, false],
  ['[A] / header=[B] / insert-B', [A], [B], B, false],
  ['[A] / header=[B] / insert-C', [A], [B], C, false],

  // ── Single membership [A], header=[C] — C not in membership ─────────────
  ['[A] / header=[C] / insert-A', [A], [C], A, false],
  ['[A] / header=[C] / insert-B', [A], [C], B, false],
  ['[A] / header=[C] / insert-C', [A], [C], C, false],

  // ── Memberships [A(primary), B], no header → write-target = A ───────────
  ['[A,B] / no-header / insert-A', [A, B], [], A, true],
  ['[A,B] / no-header / insert-B', [A, B], [], B, false],
  ['[A,B] / no-header / insert-C', [A, B], [], C, false],

  // ── Memberships [A,B], header=[A] → write-target = A ────────────────────
  ['[A,B] / header=[A] / insert-A', [A, B], [A], A, true],
  ['[A,B] / header=[A] / insert-B', [A, B], [A], B, false],
  ['[A,B] / header=[A] / insert-C', [A, B], [A], C, false],

  // ── Memberships [A,B], header=[B] → write-target = B (the fix) ──────────
  ['[A,B] / header=[B] / insert-A', [A, B], [B], A, false],
  ['[A,B] / header=[B] / insert-B', [A, B], [B], B, true],
  ['[A,B] / header=[B] / insert-C', [A, B], [B], C, false],

  // ── Memberships [A,B], header=[C] — C not in membership ─────────────────
  ['[A,B] / header=[C] / insert-A', [A, B], [C], A, false],
  ['[A,B] / header=[C] / insert-B', [A, B], [C], B, false],
  ['[A,B] / header=[C] / insert-C', [A, B], [C], C, false],

  // ── Memberships [A,B], header=[A,B] → multi-scope, write-target = A ─────
  ['[A,B] / header=[A,B] / insert-A', [A, B], [A, B], A, true],
  ['[A,B] / header=[A,B] / insert-B', [A, B], [A, B], B, false],
  ['[A,B] / header=[A,B] / insert-C', [A, B], [A, B], C, false],

  // ── Memberships [A,B], header=[A,C] — C not in membership ───────────────
  ['[A,B] / header=[A,C] / insert-A', [A, B], [A, C], A, false],
  ['[A,B] / header=[A,C] / insert-B', [A, B], [A, C], B, false],
  ['[A,B] / header=[A,C] / insert-C', [A, B], [A, C], C, false],
];

// ---------------------------------------------------------------------------

describe('RLS write-target: X-Business-Scope header controls insert target', () => {
  let db: TestDatabase;
  let pool: Pool;
  // Monotonically increasing key so each test row uses a unique (key, owner_id)
  // even within the same rolled-back transaction.
  let keyCounter = 1;

  beforeAll(async () => {
    db = new TestDatabase();
    pool = await db.connect();

    // Create the non-superuser role for RLS enforcement and grant it the
    // table + schema privileges needed for the INSERT under test.
    await ensureRlsRole(pool, { grants: SORT_CODES_GRANTS });

    const setup = await pool.connect();
    try {
      // Create fixture businesses A, B, C as self-owned entities.
      // Committed so they persist across all per-test rolled-back transactions.
      await setup.query('BEGIN');
      for (const id of [A, B, C]) {
        await setup.query(`SELECT set_config('app.current_business_id', $1, true)`, [id]);
        await setup.query(
          `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
           VALUES ($1, $2, $3, NULL)
           ON CONFLICT (id) DO NOTHING`,
          [id, id, 'business'],
        );
        await setup.query(
          `INSERT INTO accounter_schema.businesses (id, country, owner_id)
           VALUES ($1, $2, $1)
           ON CONFLICT (id) DO NOTHING`,
          [id, 'ISR'],
        );
        await setup.query(
          `UPDATE accounter_schema.financial_entities SET owner_id = $1 WHERE id = $1`,
          [id],
        );
      }
      await setup.query('COMMIT');
    } catch (e) {
      try { await setup.query('ROLLBACK'); } catch { /* ignore */ }
      throw e;
    } finally {
      setup.release();
    }
  });

  afterAll(async () => {
    const teardown = await pool.connect();
    try {
      await teardown.query('SET row_security = off');
      // Deletion order matters: sort_codes → break the circular FK between
      // businesses ↔ financial_entities by nulling it first, then delete both.
      await teardown.query(
        `DELETE FROM accounter_schema.sort_codes WHERE owner_id IN ($1, $2, $3)`,
        [A, B, C],
      );
      await teardown.query(
        `UPDATE accounter_schema.financial_entities SET owner_id = NULL WHERE id IN ($1, $2, $3)`,
        [A, B, C],
      );
      await teardown.query(
        `DELETE FROM accounter_schema.businesses WHERE id IN ($1, $2, $3)`,
        [A, B, C],
      );
      await teardown.query(
        `DELETE FROM accounter_schema.financial_entities WHERE id IN ($1, $2, $3)`,
        [A, B, C],
      );
      await teardown.query('RESET row_security');
    } finally {
      teardown.release();
    }
    await dropRlsRole(pool, { grants: SORT_CODES_GRANTS });
    // Pool managed by global vitest setup — do not close here.
  });

  test.each(MATRIX)(
    '%s',
    async (_label, memberships, scopeHeader, insertTarget, shouldSucceed) => {
      const key = keyCounter++;
      const { writeTarget, scopeArray } = deriveRLSContext(memberships, scopeHeader);

      await db.withTransaction(async client => {
        const succeeded = await attemptInsert(client, writeTarget, scopeArray, insertTarget, key);
        expect(succeeded).toBe(shouldSucceed);
      });
    },
  );
});
