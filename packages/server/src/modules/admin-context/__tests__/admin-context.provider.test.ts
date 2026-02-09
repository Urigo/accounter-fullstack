import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { AdminContextProvider } from '../providers/admin-context.provider.js';
import { QueryResult, QueryResultRow } from 'pg';
import { DBProvider } from 'modules/app-providers/db.provider.js';

type QueryResultWithRows<T extends QueryResultRow = QueryResultRow> = QueryResult<T> & {rowCount: number};

describe('AdminContextProvider', () => {
  let provider: AdminContextProvider;
  let dbProvider: Mocked<DBProvider>;
  let context: GraphQLModules.GlobalContext;

  beforeEach(() => {
    dbProvider = {
      pool: {
        query: vi.fn(),
      },
      healthCheck: vi.fn(),
      query: vi.fn(),
    } as unknown as Mocked<DBProvider>;
    context = {
      currentUser: { userId: 'test-owner-id' },
    } as GraphQLModules.GlobalContext;

    // Inject mocks: context (for ownerId) and dbProvider
    provider = new AdminContextProvider(context, dbProvider);
  });

  it('should fetch admin context for the current user', async () => {
    dbProvider.query.mockResolvedValue({
      rows: [{ owner_id: 'test-owner-id', default_local_currency: 'USD' }],
      rowCount: 1,
    } as unknown as QueryResultWithRows);

    const result = await provider.getAdminContext();
    expect(result).toBeDefined();
    expect(result?.default_local_currency).toBe('USD');
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

    dbProvider.query.mockResolvedValueOnce({
        rows: [{ owner_id: 'test-owner-id', default_local_currency: 'EUR' }],
        rowCount: 1
    } as unknown as QueryResultWithRows); // get again
    
    const result = await provider.getAdminContext();
    expect(result?.default_local_currency).toBe('EUR');
    expect(dbProvider.query).toHaveBeenCalledTimes(3); // +1 for refetch
  });
});
