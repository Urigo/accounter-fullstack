import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { AdminContextProvider } from '../providers/admin-context.provider.js';
import { QueryResult, QueryResultRow } from 'pg';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import type { AuthContext } from '../../../shared/types/auth.js';

type QueryResultWithRows<T extends QueryResultRow = QueryResultRow> = QueryResult<T> & {rowCount: number};

const asQueryResult = (rows: QueryResultRow[]): QueryResultWithRows =>
  ({ rows, rowCount: rows.length }) as unknown as QueryResultWithRows;

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

  it('should prefer single-business active scope over primary tenant business', async () => {
    const scopedOwnerId = 'scoped-owner-id';
    const primaryOwnerId = 'primary-owner-id';

    authContextProvider.getAuthContext.mockResolvedValue({
      authType: 'jwt',
      tenant: {
        businessId: primaryOwnerId,
      },
      activeReadScope: {
        businessIds: [scopedOwnerId],
      },
    } as AuthContext);

    dbProvider.query.mockImplementation((_statement, values) => {
      const serializedValues = JSON.stringify(values ?? []);
      if (serializedValues.includes(scopedOwnerId)) {
        return Promise.resolve(
          asQueryResult([{ owner_id: scopedOwnerId, default_local_currency: 'USD' }]),
        );
      }
      return Promise.resolve(asQueryResult([]));
    });

    const result = await provider.getVerifiedAdminContext();
    expect(result.ownerId).toBe(scopedOwnerId);
  });

  it('should prefer primary tenant business when it is inside multi-business active scope', async () => {
    const primaryOwnerId = 'primary-owner-id';

    authContextProvider.getAuthContext.mockResolvedValue({
      authType: 'jwt',
      tenant: {
        businessId: primaryOwnerId,
      },
      activeReadScope: {
        businessIds: ['scope-owner-a', primaryOwnerId, 'scope-owner-b'],
      },
    } as AuthContext);

    dbProvider.query.mockImplementation((_statement, values) => {
      const serializedValues = JSON.stringify(values ?? []);
      if (serializedValues.includes(primaryOwnerId)) {
        return Promise.resolve(
          asQueryResult([{ owner_id: primaryOwnerId, default_local_currency: 'USD' }]),
        );
      }
      return Promise.resolve(asQueryResult([]));
    });

    const result = await provider.getVerifiedAdminContext();
    expect(result.ownerId).toBe(primaryOwnerId);
  });

  it('should fallback to first scoped business when primary tenant business is outside active scope', async () => {
    const primaryOwnerId = 'primary-owner-id';
    const firstScopedOwnerId = 'scope-owner-a';

    authContextProvider.getAuthContext.mockResolvedValue({
      authType: 'jwt',
      tenant: {
        businessId: primaryOwnerId,
      },
      activeReadScope: {
        businessIds: [firstScopedOwnerId, 'scope-owner-b'],
      },
    } as AuthContext);

    dbProvider.query.mockImplementation((_statement, values) => {
      const serializedValues = JSON.stringify(values ?? []);
      if (serializedValues.includes(firstScopedOwnerId)) {
        return Promise.resolve(
          asQueryResult([{ owner_id: firstScopedOwnerId, default_local_currency: 'USD' }]),
        );
      }
      return Promise.resolve(asQueryResult([]));
    });

    const result = await provider.getVerifiedAdminContext();
    expect(result.ownerId).toBe(firstScopedOwnerId);
  });

  it('should use single-business active scope when updating admin context', async () => {
    const scopedOwnerId = 'scoped-owner-id';
    const primaryOwnerId = 'primary-owner-id';

    authContextProvider.getAuthContext.mockResolvedValue({
      authType: 'jwt',
      tenant: {
        businessId: primaryOwnerId,
      },
      activeReadScope: {
        businessIds: [scopedOwnerId],
      },
    } as AuthContext);

    dbProvider.query.mockImplementation((_statement, values) => {
      const serializedValues = JSON.stringify(values ?? []);
      if (serializedValues.includes(scopedOwnerId)) {
        return Promise.resolve(
          asQueryResult([{ owner_id: scopedOwnerId, default_local_currency: 'EUR' }]),
        );
      }
      return Promise.resolve(asQueryResult([]));
    });

    const result = await provider.updateAdminContext({ defaultLocalCurrency: 'EUR' });

    expect(result?.ownerId).toBe(scopedOwnerId);
    expect(result?.defaultLocalCurrency).toBe('EUR');
  });

  // Loading a context takes two queries: the user_context row, then the tenant's security
  // businesses, which join internalWalletsIds.
  const QUERIES_PER_CONTEXT_LOAD = 2;

  /**
   * The two queries return different shapes, so they are stubbed separately: answering the
   * security-businesses query with a user_context row would put an `undefined` id into
   * internalWalletsIds and hide the very thing the enrichment is supposed to do.
   */
  function mockContextLoad(
    context: Record<string, unknown>,
    securityBusinesses: Array<{ id: string; owner_id: string }> = [],
  ) {
    dbProvider.query.mockResolvedValueOnce({
      rows: [context],
      rowCount: 1,
    } as unknown as QueryResultWithRows);
    dbProvider.query.mockResolvedValueOnce({
      rows: securityBusinesses,
      rowCount: securityBusinesses.length,
    } as unknown as QueryResultWithRows);
  }

  it('should cache the result', async () => {
    mockContextLoad({ owner_id: 'test-owner-id' });

    await provider.getAdminContext();
    await provider.getAdminContext();
    expect(dbProvider.query).toHaveBeenCalledTimes(QUERIES_PER_CONTEXT_LOAD);
  });

  it('adds the security businesses to the internal wallets, once each', async () => {
    const generalSecuritiesId = '0190a1b2-0000-7000-8000-0000000000e1';
    mockContextLoad(
      {
        owner_id: 'test-owner-id',
        securities_context: { foreignSecuritiesBusinessId: generalSecuritiesId },
      },
      [
        { id: 'security-a', owner_id: 'test-owner-id' },
        { id: 'security-b', owner_id: 'test-owner-id' },
        // Already an internal wallet through the context itself.
        { id: generalSecuritiesId, owner_id: 'test-owner-id' },
      ],
    );

    const context = await provider.getAdminContext();

    const walletIds = context!.financialAccounts.internalWalletsIds;
    expect(walletIds).toEqual(expect.arrayContaining(['security-a', 'security-b']));
    expect(walletIds.filter(id => id === generalSecuritiesId)).toHaveLength(1);
    expect(walletIds).not.toContain(undefined);
  });

  it('no longer reads the deprecated foreign securities columns', async () => {
    mockContextLoad({
      owner_id: 'test-owner-id',
      foreign_securities_business_id: '0190a1b2-0000-7000-8000-0000000000e2',
      foreign_securities_fees_category_id: '0190a1b2-0000-7000-8000-0000000000e3',
    });

    const context = await provider.getAdminContext();

    expect(context!.foreignSecurities.foreignSecuritiesBusinessId).toBeNull();
    expect(context!.foreignSecurities.foreignSecuritiesFeesCategoryId).toBeNull();
    expect(context!.financialAccounts.internalWalletsIds).not.toContain(
      '0190a1b2-0000-7000-8000-0000000000e2',
    );
  });

  it('should invalidate cache on update', async () => {
    mockContextLoad({ owner_id: 'test-owner-id', default_local_currency: 'USD' });

    await provider.getAdminContext();
    expect(dbProvider.query).toHaveBeenCalledTimes(QUERIES_PER_CONTEXT_LOAD);

    mockContextLoad({ owner_id: 'test-owner-id', default_local_currency: 'EUR' });

    await provider.updateAdminContext({ defaultLocalCurrency: 'EUR' });
    expect(dbProvider.query).toHaveBeenCalledTimes(QUERIES_PER_CONTEXT_LOAD * 2);

    // The cache should now have the updated value from updateAdminContext
    const result = await provider.getAdminContext();
    expect(result?.defaultLocalCurrency).toBe('EUR');
    // No additional call, using cache
    expect(dbProvider.query).toHaveBeenCalledTimes(QUERIES_PER_CONTEXT_LOAD * 2);
  });
});
