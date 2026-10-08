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
    mockContextLoad(
      { owner_id: 'test-owner-id', foreign_securities_business_id: 'general-securities' },
      [
        { id: 'security-a', owner_id: 'test-owner-id' },
        { id: 'security-b', owner_id: 'test-owner-id' },
        // Already an internal wallet through the context itself.
        { id: 'general-securities', owner_id: 'test-owner-id' },
      ],
    );

    const context = await provider.getAdminContext();

    const walletIds = context!.financialAccounts.internalWalletsIds;
    expect(walletIds).toEqual(expect.arrayContaining(['security-a', 'security-b']));
    expect(walletIds.filter(id => id === 'general-securities')).toHaveLength(1);
    expect(walletIds).not.toContain(undefined);
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

  describe('normalizeContext (data-driven admin_business_roles)', () => {
    const buildRow = (overrides: Record<string, unknown>) =>
      ({
        owner_id: 'owner-1',
        default_local_currency: 'ILS',
        default_fiat_currency_for_crypto_conversions: 'USD',
        ...overrides,
      }) as unknown as Parameters<AdminContextProvider['normalizeContext']>[0];

    it('derives data-source arrays from the role aggregate columns', () => {
      const ctx = provider.normalizeContext(
        buildRow({
          bank_account_business_ids: ['bank-1', 'bank-2'],
          credit_card_business_ids: ['card-1'],
          crypto_wallet_business_ids: ['wallet-1'],
          foreign_securities_business_id: 'fs-1',
        }),
      );

      expect(ctx.financialAccounts.bankAccountIds).toEqual(['bank-1', 'bank-2']);
      expect(ctx.financialAccounts.creditCardIds).toEqual(['card-1']);
      expect(ctx.financialAccounts.internalWalletsIds).toEqual(
        expect.arrayContaining(['bank-1', 'bank-2', 'card-1', 'wallet-1', 'fs-1']),
      );
      expect(ctx.financialAccounts.internalWalletsIds).toHaveLength(5);
    });

    it('derives dividend and VAT-excluded arrays from roles without any hardcoded UUIDs', () => {
      const ctx = provider.normalizeContext(
        buildRow({
          dividend_payment_business_ids: ['div-1'],
          dividend_withholding_tax_business_id: 'wh-1',
          vat_excluded_business_ids: ['vat-1', 'tax-1', 'ss-1'],
        }),
      );

      expect(ctx.dividends.dividendPaymentBusinessIds).toEqual(['div-1']);
      expect(ctx.dividends.dividendBusinessIds).toEqual(['wh-1', 'div-1']);
      expect(ctx.authorities.vatReportExcludedBusinessNames).toEqual(['vat-1', 'tax-1', 'ss-1']);
      // The previously hardcoded, cross-tenant dividend UUIDs must no longer leak in.
      expect(ctx.dividends.dividendPaymentBusinessIds).not.toContain(
        '4bcca705-5b47-41c5-ba26-1e42c69cbf0d',
      );
      expect(ctx.dividends.dividendPaymentBusinessIds).not.toContain(
        '909fbe3c-0419-44ed-817d-ab774e93748a',
      );
    });

    it('defaults every role-derived array to empty when the aggregates are absent', () => {
      const ctx = provider.normalizeContext(buildRow({}));

      expect(ctx.financialAccounts.bankAccountIds).toEqual([]);
      expect(ctx.financialAccounts.creditCardIds).toEqual([]);
      expect(ctx.financialAccounts.internalWalletsIds).toEqual([]);
      expect(ctx.dividends.dividendPaymentBusinessIds).toEqual([]);
      expect(ctx.dividends.dividendBusinessIds).toEqual([]);
      expect(ctx.authorities.vatReportExcludedBusinessNames).toEqual([]);
    });

    it('de-duplicates internal wallets when one business holds multiple roles', () => {
      const ctx = provider.normalizeContext(
        buildRow({
          bank_account_business_ids: ['dup', 'bank-2'],
          credit_card_business_ids: ['dup'],
          crypto_wallet_business_ids: ['dup'],
          foreign_securities_business_id: 'dup',
        }),
      );

      expect(ctx.financialAccounts.internalWalletsIds).toEqual(['dup', 'bank-2']);
    });
  });
});
