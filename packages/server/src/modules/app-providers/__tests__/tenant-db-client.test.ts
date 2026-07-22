import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import type { AuthContext } from '../../../shared/types/auth.js';
import { DBProvider } from '../db.provider.js';
import { TenantAwareDBClient } from '../tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';

describe('TenantAwareDBClient', () => {
  let mockPoolClient: PoolClient;
  let mockPool: Pool;
  let mockDBProvider: DBProvider;
  let mockAuthContext: AuthContext;
  let tenantDBClient: TenantAwareDBClient;

  beforeEach(() => {
    // Mock PoolClient
    mockPoolClient = {
      query: vi.fn(),
      release: vi.fn(),
    } as unknown as PoolClient;

    // Mock Pool
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockPoolClient),
    } as unknown as Pool;

    // Mock DBProvider
    mockDBProvider = {
      pool: mockPool,
      healthCheck: vi.fn(),
      shutdown: vi.fn(),
      query: vi.fn(),
    } as unknown as DBProvider;

    // Mock AuthContext
    mockAuthContext = {
      authType: 'jwt',
      token: 'token',
      user: {
        userId: 'user-123',
        roleId: 'admin',
        email: 'test@test.com',
        permissions: [],
        emailVerified: true,
        permissionsVersion: 1,
      },
      tenant: {
        businessId: 'business-456',
        roleId: 'admin',
      },
      activeReadScope: { businessIds: ['business-456'] },
    };

    const authContextProvider = {getAuthContext: () => Promise.resolve(mockAuthContext)} as AuthContextProvider;

    tenantDBClient = new TenantAwareDBClient(mockDBProvider, authContextProvider);
  });

  describe('query', () => {
    it('should throw if auth context is missing', async () => {
      tenantDBClient = new TenantAwareDBClient(mockDBProvider, null as any);
      
      await expect(tenantDBClient.query('SELECT 1'))
        .rejects
        .toThrow('Auth context not available. TenantAwareDBClient requires active authentication.');
    });

    it('should open a request-scoped session and keep it open for reads', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);

      await tenantDBClient.query('SELECT 1');

      // Session flow: BEGIN + RLS, then the query — no COMMIT/release until dispose
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockPoolClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockPoolClient.query).toHaveBeenCalledWith(expect.stringContaining("set_config('app.current_business_id', $1, true)"), expect.anything());
      expect(mockPoolClient.query).toHaveBeenCalledWith('SELECT 1', undefined);
      expect(mockPoolClient.query).not.toHaveBeenCalledWith('COMMIT');
      expect(mockPoolClient.release).not.toHaveBeenCalled();

      await tenantDBClient.dispose();

      expect(mockPoolClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it('should reuse the open session across sequential read queries', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);

      await tenantDBClient.query('SELECT 1');
      await tenantDBClient.query('SELECT 2');

      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      const beginCalls = vi.mocked(mockPoolClient.query).mock.calls.filter(call => call[0] === 'BEGIN');
      expect(beginCalls).toHaveLength(1);
    });

    it('should commit a data-modifying query immediately and reopen the session on the next query', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);

      await tenantDBClient.query('UPDATE accounter_schema.charges SET user_description = $1', ['x']);

      expect(mockPoolClient.query).toHaveBeenCalledWith('COMMIT');

      await tenantDBClient.query('SELECT 1');

      const beginCalls = vi.mocked(mockPoolClient.query).mock.calls.filter(call => call[0] === 'BEGIN');
      expect(beginCalls).toHaveLength(2);
      // The pooled connection itself is reused across sessions
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
    });

    it('should roll back a failed query and recover with a fresh session', async () => {
      const failure = new Error('bad query');
      vi.mocked(mockPoolClient.query).mockImplementation(((text: string) =>
        text === 'SELECT broken'
          ? Promise.reject(failure)
          : Promise.resolve({ rows: [] })) as any);

      await expect(tenantDBClient.query('SELECT broken')).rejects.toThrow(failure);
      expect(mockPoolClient.query).toHaveBeenCalledWith('ROLLBACK');

      await tenantDBClient.query('SELECT 1');

      const beginCalls = vi.mocked(mockPoolClient.query).mock.calls.filter(call => call[0] === 'BEGIN');
      expect(beginCalls).toHaveLength(2);
    });

    it('should commit and release after every query in autoRelease mode', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      tenantDBClient.autoRelease = true;

      await tenantDBClient.query('SELECT 1');

      expect(mockPoolClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it('should reuse existing transaction', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);

      await tenantDBClient.transaction(async () => {
        await tenantDBClient.query('SELECT 1');
      });

      // connect called only once
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      // BEGIN called once
      expect(mockPoolClient.query).toHaveBeenCalledWith('BEGIN');
      // SELECT called inside transaction
      expect(mockPoolClient.query).toHaveBeenCalledWith('SELECT 1', undefined);
      // outermost transaction scope commits promptly
      expect(mockPoolClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('transaction', () => {
    it('should throw if auth context is missing', async () => {
        tenantDBClient = new TenantAwareDBClient(mockDBProvider, null as any);
        
        await expect(tenantDBClient.transaction(async () => {}))
          .rejects
          .toThrow('Auth context not available. TenantAwareDBClient requires active authentication.');
      });

    it('should handle nested transactions with savepoints', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);

      await tenantDBClient.transaction(async () => {
        await tenantDBClient.transaction(async () => {
          await tenantDBClient.query('SELECT 1');
        });
      });

      expect(mockPoolClient.query).toHaveBeenCalledWith('SAVEPOINT sp_2');
      expect(mockPoolClient.query).toHaveBeenCalledWith('RELEASE SAVEPOINT sp_2');
    });

    it('should fallback nested transaction on error', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      const error = new Error('nested error');

      await expect(tenantDBClient.transaction(async () => {
        await tenantDBClient.transaction(async () => {
          throw error;
        });
      })).rejects.toThrow(error);

      expect(mockPoolClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_2');
    });

    it('should rollback top-level transaction on error', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      const error = new Error('top error');

      await expect(tenantDBClient.transaction(async () => {
        throw error;
      })).rejects.toThrow(error);

      expect(mockPoolClient.query).toHaveBeenCalledWith('ROLLBACK');
      // The pooled connection is retained for the rest of the request
      expect(mockPoolClient.release).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should commit the open session and release the client', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      await tenantDBClient.query('SELECT 1');

      await tenantDBClient.dispose();

      expect(mockPoolClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockPoolClient.release).toHaveBeenCalled();
      expect((tenantDBClient as any).activeClient).toBeNull();
    });

    it('should wait for ongoing transaction to complete before disposing', async () => {
      // Start a transaction first to initialize activeClient
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      
      let transactionFinished = false;
      void tenantDBClient.transaction(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          transactionFinished = true;
      });

      // Ensure transaction started (mutex acquired)
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Call dispose. This should await the mutex (wait for transaction)
      await tenantDBClient.dispose();

      expect(transactionFinished).toBe(true);
      expect(mockPoolClient.query).toHaveBeenCalledWith('COMMIT'); // completed naturally
      expect(mockPoolClient.release).toHaveBeenCalled();
      
      // Verify subsequent calls fail
      await expect(tenantDBClient.query('SELECT 1')).rejects.toThrow('TenantAwareDBClient is already disposed');
    });

    it('should be idempotent', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      await tenantDBClient.query('SELECT 1');

      await tenantDBClient.dispose();
      await tenantDBClient.dispose();

      expect(mockPoolClient.release).toHaveBeenCalledTimes(1);
    });

    it('should destroy the client if the final commit fails', async () => {
      const commitError = new Error('Commit failed');
      vi.mocked(mockPoolClient.query).mockImplementation(((text: string) =>
        text === 'COMMIT' ? Promise.reject(commitError) : Promise.resolve({ rows: [] })) as any);
      await tenantDBClient.query('SELECT 1');

      await tenantDBClient.dispose();

      // The connection state is unknown after a failed COMMIT — destroy it
      expect(mockPoolClient.release).toHaveBeenCalledWith(true);
      expect((tenantDBClient as any).activeClient).toBeNull();
    });

    it('should return early on timeout if mutex is held (avoid race condition)', async () => {
      // Use fake timers to fast-forward the 5s timeout
      vi.useFakeTimers();

      // Mock active client
      (tenantDBClient as any).activeClient = mockPoolClient;
      
      // Acquire mutex manually to simulate stuck transaction
      // We need access to the mutex which is private.
      // Casting to any allows access for testing.
      const release = await (tenantDBClient as any).mutex.acquire();
      
      const disposePromise = tenantDBClient.dispose();

      // Advance timers by 5000ms + buffer (must handle async promise resolution)
      await vi.advanceTimersByTimeAsync(6000);

      await disposePromise;

      // Assertions (before releasing the mutex — cleanup is deferred until the
      // in-flight operation frees it, so releasing first would race them)
      // 1. Client should NOT be released yet to avoid destroying an
      //    actively-used connection (prevents race condition)
      expect(mockPoolClient.release).not.toHaveBeenCalled();
      // 2. activeClient should still be set (cleanup deferred until mutex frees)
      expect((tenantDBClient as any).activeClient).toBe(mockPoolClient);
      // 3. isDisposed SHOULD be true to prevent further usage of this instance
      expect((tenantDBClient as any).isDisposed).toBe(true);

      // Cleanup: releasing the mutex lets the deferred cleanup run
      release();
      vi.useRealTimers();
    });
  });

  describe('RLS variables', () => {
    it('should set correct RLS variables', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);

      await tenantDBClient.query('SELECT 1');

      const expectedVars = [
        'business-456',
        'user-123',
        'jwt',
        '{"business-456"}',
      ];

      // Find the call that sets variables
      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) =>
        call[0].includes("set_config('app.current_business_id', $1, true)")
      );

      expect(setCall).toBeDefined();
      expect(setCall![1]).toEqual(expectedVars);
    });

    it('should throw if businessId is missing in auth context and no single-scoped business', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      // No tenant.businessId and no activeReadScope → no write target can be derived
      (tenantDBClient as any).authContext = { ...mockAuthContext, tenant: {}, activeReadScope: undefined };
      (tenantDBClient as any).authContextInitialized = true;

      await expect(tenantDBClient.query('SELECT 1')).rejects.toThrow('Missing businessId in AuthContext');
    });

    it('should use the single scoped business as write target when tenant.businessId is absent', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      // tenant.businessId missing but activeReadScope has exactly one business
      (tenantDBClient as any).authContext = {
        ...mockAuthContext,
        tenant: {},
        activeReadScope: { businessIds: ['business-456'] },
      };
      (tenantDBClient as any).authContextInitialized = true;

      await tenantDBClient.query('SELECT 1');

      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) =>
        call[0].includes("set_config('app.current_business_id', $1, true)"),
      );
      expect(setCall).toBeDefined();
      expect(setCall![1][0]).toBe('business-456');
    });

    it('sets the write target and the read-scope array session variables', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);

      await tenantDBClient.query('SELECT 1');

      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) =>
        call[0].includes('set_config('),
      );

      expect(setCall).toBeDefined();
      const sql = setCall![0] as string;
      expect(sql).toContain("set_config('app.current_business_id', $1, true)");
      expect(sql).toContain("set_config('app.current_user_id', $2, true)");
      expect(sql).toContain("set_config('app.auth_type', $3, true)");
      expect(sql).toContain("set_config('app.current_business_scope', $4, true)");
      expect(setCall![1]).toHaveLength(4);
    });

    it('serializes a multi-business read scope as a Postgres array literal', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      (tenantDBClient as any).authContext = {
        ...mockAuthContext,
        activeReadScope: { businessIds: ['business-456', 'business-789'] },
      };
      (tenantDBClient as any).authContextInitialized = true;

      await tenantDBClient.query('SELECT 1');

      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) =>
        call[0].includes("set_config('app.current_business_scope', $4, true)"),
      );
      expect(setCall).toBeDefined();
      expect(setCall![1][3]).toBe('{"business-456","business-789"}');
    });

    it('passes an empty read scope when none is resolved (DB falls back to single business)', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      (tenantDBClient as any).authContext = {
        ...mockAuthContext,
        activeReadScope: undefined,
      };
      (tenantDBClient as any).authContextInitialized = true;

      await tenantDBClient.query('SELECT 1');

      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) =>
        call[0].includes("set_config('app.current_business_scope', $4, true)"),
      );
      expect(setCall).toBeDefined();
      expect(setCall![1][3]).toBe('');
    });

    it('uses single scoped business as write target, overriding primary tenant', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      // Primary is 'business-456', but X-Business-Scope narrows to 'business-789'
      (tenantDBClient as any).authContext = {
        ...mockAuthContext,
        tenant: { businessId: 'business-456', roleId: 'admin' },
        activeReadScope: { businessIds: ['business-789'] },
      };
      (tenantDBClient as any).authContextInitialized = true;

      await tenantDBClient.query('SELECT 1');

      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) =>
        call[0].includes("set_config('app.current_business_id', $1, true)"),
      );
      expect(setCall).toBeDefined();
      // write target should be the single scoped business, not the primary
      expect(setCall![1][0]).toBe('business-789');
    });

    it('falls back to primary tenant when multi-scope includes primary', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      (tenantDBClient as any).authContext = {
        ...mockAuthContext,
        tenant: { businessId: 'business-456', roleId: 'admin' },
        activeReadScope: { businessIds: ['business-456', 'business-789'] },
      };
      (tenantDBClient as any).authContextInitialized = true;

      await tenantDBClient.query('SELECT 1');

      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) =>
        call[0].includes("set_config('app.current_business_id', $1, true)"),
      );
      expect(setCall).toBeDefined();
      expect(setCall![1][0]).toBe('business-456');
    });

    it('uses first scoped business as write target when multi-scope excludes primary', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);
      // Primary is 'business-456' but active scope is ['business-789', 'business-abc']
      // — primary is not in scope, so writing to it would violate RLS WITH CHECK.
      (tenantDBClient as any).authContext = {
        ...mockAuthContext,
        tenant: { businessId: 'business-456', roleId: 'admin' },
        activeReadScope: { businessIds: ['business-789', 'business-abc'] },
      };
      (tenantDBClient as any).authContextInitialized = true;

      await tenantDBClient.query('SELECT 1');

      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) =>
        call[0].includes("set_config('app.current_business_id', $1, true)"),
      );
      expect(setCall).toBeDefined();
      expect(setCall![1][0]).toBe('business-789');
    });
  });
});

