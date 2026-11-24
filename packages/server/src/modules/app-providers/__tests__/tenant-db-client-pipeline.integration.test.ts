import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../__tests__/helpers/db-connection.js';
import type { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../db.provider.js';
import { TenantAwareDBClient } from '../tenant-db-client.js';

/**
 * A request's reads pipelined on one real Postgres connection: they share the request's
 * transaction and RLS settings, a failing read leaves the others intact, and writes still commit
 * at once.
 */

let pool: Pool;
const BUSINESS = randomUUID();
const TABLE = `pipeline_test_${randomUUID().replaceAll('-', '_')}`;

/** A request-scoped client, as a GraphQL operation gets one. Dispose it when done. */
function requestClient(): TenantAwareDBClient {
  const authContextProvider = {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId: BUSINESS },
        user: { userId: 'api-key:test', roleId: 'admin', permissions: [] },
      }),
  } as unknown as AuthContextProvider;
  const context = {
    dbRequest: {
      clientsToDispose: [],
      executionInFlight: true,
      disposed: false,
      requestId: 'pipeline-test',
      operationName: null,
    },
  } as unknown as GraphQLModules.GlobalContext;
  return new TenantAwareDBClient(new DBProvider(pool), authContextProvider, context);
}

beforeAll(async () => {
  pool = await connectTestDb();
  await pool.query(`CREATE TABLE public.${TABLE} (id int PRIMARY KEY)`);
});

afterAll(async () => {
  await pool.query(`DROP TABLE IF EXISTS public.${TABLE}`);
  // Do NOT close the pool here — it is shared with other concurrently-running suites.
});

describe('TenantAwareDBClient read pipelining against Postgres', () => {
  it('runs concurrent reads in the one request transaction, with its RLS settings', async () => {
    const client = requestClient();
    try {
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          client.query<{ business: string; tx: string; n: number }>(
            `SELECT current_setting('app.current_business_id', true) AS business,
                    txid_current()::text AS tx,
                    $1::int AS n`,
            [index],
          ),
        ),
      );

      expect(results.map(result => result.rows[0]!.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(new Set(results.map(result => result.rows[0]!.business))).toEqual(
        new Set([BUSINESS]),
      );
      expect(new Set(results.map(result => result.rows[0]!.tx)).size).toBe(1);
    } finally {
      await client.dispose();
    }
  });

  it('fails only the read that failed, and the others still return', async () => {
    const client = requestClient();
    try {
      const outcomes = await Promise.all(
        ['SELECT 1 AS v', 'SELECT 1 / 0 AS v', 'SELECT 3 AS v', 'SELECT 4 AS v'].map(text =>
          client.query<{ v: number }>(text).then(
            result => result.rows[0]!.v,
            (error: { code?: string }) => error.code,
          ),
        ),
      );

      // 22012: division by zero. The reads pipelined behind it were retried on a fresh session.
      expect(outcomes).toEqual([1, '22012', 3, 4]);
      await expect(client.query<{ v: number }>('SELECT 5 AS v')).resolves.toMatchObject({
        rows: [{ v: 5 }],
      });
    } finally {
      await client.dispose();
    }
  });

  it('commits a write that was waiting behind a failed read', async () => {
    const client = requestClient();
    const id = Math.floor(Math.random() * 1_000_000);
    try {
      // The write is asked for while both reads are in flight, so it is the next to take the
      // session, which the first read has aborted by then.
      const [failed, retried, written] = await Promise.all([
        client.query('SELECT 1 / 0 AS v').then(
          () => 'ok',
          (error: { code?: string }) => error.code,
        ),
        client.query<{ v: number }>('SELECT 2 AS v'),
        client.query(`INSERT INTO public.${TABLE} (id) VALUES ($1)`, [id]),
      ]);

      expect(failed).toBe('22012');
      expect(retried.rows).toEqual([{ v: 2 }]);
      expect(written.rowCount).toBe(1);
      const elsewhere = await pool.query(`SELECT id FROM public.${TABLE} WHERE id = $1`, [id]);
      expect(elsewhere.rows).toEqual([{ id }]);
    } finally {
      await client.dispose();
    }
  });

  it('commits a transaction() scope that was waiting behind a failed read', async () => {
    const client = requestClient();
    const id = Math.floor(Math.random() * 1_000_000);
    try {
      const [failed, inserted] = await Promise.all([
        client.query('SELECT 1 / 0 AS v').then(
          () => 'ok',
          (error: { code?: string }) => error.code,
        ),
        client.transaction(async tx => {
          const result = await tx.query(`INSERT INTO public.${TABLE} (id) VALUES ($1)`, [id]);
          return result.rowCount;
        }),
      ]);

      expect(failed).toBe('22012');
      expect(inserted).toBe(1);
      const elsewhere = await pool.query(`SELECT id FROM public.${TABLE} WHERE id = $1`, [id]);
      expect(elsewhere.rows).toEqual([{ id }]);
    } finally {
      await client.dispose();
    }
  });

  it('commits a write at once, and the reads after it see it', async () => {
    const client = requestClient();
    const id = Math.floor(Math.random() * 1_000_000);
    try {
      const [, , after] = await Promise.all([
        client.query(`SELECT count(*) FROM public.${TABLE}`),
        client.query(`INSERT INTO public.${TABLE} (id) VALUES ($1)`, [id]),
        client.query<{ id: number }>(`SELECT id FROM public.${TABLE} WHERE id = $1`, [id]),
      ]);
      expect(after.rows).toEqual([{ id }]);

      // Visible from another connection before this request ends: it was committed.
      const elsewhere = await pool.query(`SELECT id FROM public.${TABLE} WHERE id = $1`, [id]);
      expect(elsewhere.rows).toEqual([{ id }]);
    } finally {
      await client.dispose();
    }
  });

  it('hands the connection back to the pool in its ordinary mode', async () => {
    const client = requestClient();
    await Promise.all([client.query('SELECT 1'), client.query('SELECT 2')]);
    await client.dispose();

    // Every idle connection the pool now holds is out of pipeline mode.
    // (pg-pool's private idle list holds each connection under `client`.)
    const idle = (pool as unknown as { _idle: Array<{ client: { pipeline: boolean } }> })._idle;
    expect(idle.length).toBeGreaterThan(0);
    expect(idle.map(item => item.client.pipeline)).not.toContain(true);
  });
});
