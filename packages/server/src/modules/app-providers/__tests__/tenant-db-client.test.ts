import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import type { AuthContext } from '../../../shared/types/auth.js';
import { DBProvider } from '../db.provider.js';
import { TenantAwareDBClient } from '../tenant-db-client.js';

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
    };

    tenantDBClient = new TenantAwareDBClient(mockDBProvider, mockAuthContext);
  });

  describe('query', () => {
    it('should start a transaction if none exists', async () => {
      vi.mocked(mockPoolClient.query).mockResolvedValue({ rows: [] } as any);

      await tenantDBClient.query('SELECT 1');

      // Check transaction flow
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockPoolClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockPoolClient.query).toHaveBeenCalledWith(expect.stringContaining("set_config('app.current_business_id', $1, true)"), expect.anything());
      expect(mockPoolClient.query).toHaveBeenCalledWith('SELECT 1', undefined);
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
    });
  });

  describe('transaction', () => {
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
      expect(mockPoolClient.release).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should rollback and release active client', async () => {
      // Start a transaction but don't finish it (simulate interruption by catching reference?)
      // Hard to simulate "mid-flight" without modifying state directly or using a hanging promise?
      // We can just call transaction and rely on internal state if we mock connect/query?
      // Alternatively, we can inspect private state or simulate a hanging transaction?
      // Easier: Manually set activeClient via `any` cast for testing dispose logic if needed,
      // or start a transaction that awaits a signal?
      
      // Let's manually set state for testing dispose specifically
      (tenantDBClient as any).activeClient = mockPoolClient;
      
      await tenantDBClient.dispose();

      expect(mockPoolClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockPoolClient.release).toHaveBeenCalled();
      expect((tenantDBClient as any).activeClient).toBeNull();
    });

    it('should be idempotent', async () => {
      (tenantDBClient as any).activeClient = mockPoolClient;
      
      await tenantDBClient.dispose();
      await tenantDBClient.dispose();

      expect(mockPoolClient.release).toHaveBeenCalledTimes(1);
    });

    it('should release client even if rollback fails', async () => {
      const rollbackError = new Error('Rollback failed');
      vi.mocked(mockPoolClient.query).mockRejectedValueOnce(rollbackError);
      (tenantDBClient as any).activeClient = mockPoolClient;

      await tenantDBClient.dispose();

      expect(mockPoolClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockPoolClient.release).toHaveBeenCalled();
      expect((tenantDBClient as any).activeClient).toBeNull();
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
      ];
      
      // Find the call that sets variables
      const setCall = vi.mocked(mockPoolClient.query).mock.calls.find((call: any[]) => 
        call[0].includes("set_config('app.current_business_id', $1, true)")
      );
      
      expect(setCall).toBeDefined();
      expect(setCall![1]).toEqual(expectedVars);
    });

    it('should throw if businessId is missing', async () => {
      (tenantDBClient as any).authContext = { ...mockAuthContext, tenant: {} };

      await expect(tenantDBClient.query('SELECT 1')).rejects.toThrow('Missing businessId in AuthContext');
    });
  });
});
