import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { AdminContextProvider } from '../providers/admin-context.provider.js';
import { QueryResult, QueryResultRow } from 'pg';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import type { AuthContext } from '../../../shared/types/auth.js';

type QueryResultWithRows<T extends QueryResultRow = QueryResultRow> = QueryResult<T> & {rowCount: number};

describe('AdminContextProvider', () => {
  let provider: AdminContextProvider;
  let dbProvider: Mocked<TenantAwareDBClient>;
  let authContextProvider: Mocked<AuthContextProvider>;

  beforeEach(() => {
    dbProvider = {
      pool: {
        query: vi.fn(),
      },
      healthCheck: vi.fn(),
      query: vi.fn(),
    } as unknown as Mocked<TenantAwareDBClient>;

    const mockAuthContext: AuthContext = {
      authType: 'jwt',
      tenant: {
        businessId: 'test-owner-id',
      },
    };

    authContextProvider = {
      getAuthContext: vi.fn().mockResolvedValue(mockAuthContext),
    } as unknown as Mocked<AuthContextProvider>;

    // Inject mocks: authContextProvider (for auth context) and dbProvider
    provider = new AdminContextProvider(authContextProvider, dbProvider);
  });

  it('should fetch admin context for the current user', async () => {
    dbProvider.query.mockResolvedValue({
      rows: [{ owner_id: 'test-owner-id', default_local_currency: 'USD' }],
      rowCount: 1,
    } as unknown as QueryResultWithRows);

    const result = await provider.getAdminContext();
    expect(result).toBeDefined();
    expect(result?.defaultLocalCurrency).toBe('USD');
    expect(dbProvider.query).toHaveBeenCalled();
  });

  it('should cache the result', async () => {
    dbProvider.query.mockResolvedValue({
      rows: [{ owner_id: 'test-owner-id' }],
      rowCount: 1,
    } as unknown as QueryResultWithRows);

    await provider.getAdminContext();
    await provider.getAdminContext();
    expect(dbProvider.query).toHaveBeenCalledTimes(1);
  });

  it('should invalidate cache on update', async () => {
    dbProvider.query.mockResolvedValueOnce({
      rows: [{ owner_id: 'test-owner-id', default_local_currency: 'USD' }],
      rowCount: 1,
    } as unknown as QueryResultWithRows); // get
    
    await provider.getAdminContext();
    expect(dbProvider.query).toHaveBeenCalledTimes(1);

    dbProvider.query.mockResolvedValueOnce({
        rows: [{ owner_id: 'test-owner-id', default_local_currency: 'EUR' }],
        rowCount: 1
    } as unknown as QueryResultWithRows); // update
    
    await provider.updateAdminContext({ defaultLocalCurrency: 'EUR' });
    expect(dbProvider.query).toHaveBeenCalledTimes(2); // +1 for update

    // The cache should now have the updated value from updateAdminContext
    const result = await provider.getAdminContext();
    expect(result?.defaultLocalCurrency).toBe('EUR');
    expect(dbProvider.query).toHaveBeenCalledTimes(2); // No additional call, using cache
  });
});
