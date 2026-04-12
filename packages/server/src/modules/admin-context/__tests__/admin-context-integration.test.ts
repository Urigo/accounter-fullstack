import { describe, expect, it, vi } from 'vitest';
import { GraphQLError } from 'graphql';
import { AdminContextProvider } from '../providers/admin-context.provider.js';
import type { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';

function createProvider(options: {
  businessId: string | null;
  row?: Record<string, unknown>;
}) {
  const query = vi.fn().mockResolvedValue({
    rows: options.row ? [options.row] : [],
    rowCount: options.row ? 1 : 0,
  });

  const db = {
    query,
  } as unknown as TenantAwareDBClient;

  const auth = {
    getAuthContext: vi.fn().mockResolvedValue(
      options.businessId
        ? {
            authType: 'jwt',
            tenant: { businessId: options.businessId },
          }
        : null,
    ),
  } as unknown as AuthContextProvider;

  return {
    provider: new AdminContextProvider(auth, db),
    query,
    auth,
  };
}

describe('AdminContext DI Integration', () => {
  it('loads admin context through provider injection', async () => {
    const { provider, query, auth } = createProvider({
      businessId: 'owner-a',
      row: {
        owner_id: 'owner-a',
        default_local_currency: 'USD',
        default_fiat_currency_for_crypto_conversions: 'USD',
        date_established: null,
        initial_accounter_year: null,
      },
    });

    const context = await provider.getVerifiedAdminContext();

    expect(context.ownerId).toBe('owner-a');
    expect(context.defaultLocalCurrency).toBe('USD');
    expect(auth.getAuthContext).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('isolates admin context between concurrent requests', async () => {
    const requestA = createProvider({
      businessId: 'owner-a',
      row: {
        owner_id: 'owner-a',
        default_local_currency: 'USD',
        default_fiat_currency_for_crypto_conversions: 'USD',
        date_established: null,
        initial_accounter_year: null,
      },
    });

    const requestB = createProvider({
      businessId: 'owner-b',
      row: {
        owner_id: 'owner-b',
        default_local_currency: 'EUR',
        default_fiat_currency_for_crypto_conversions: 'EUR',
        date_established: null,
        initial_accounter_year: null,
      },
    });

    const [contextA, contextB] = await Promise.all([
      requestA.provider.getVerifiedAdminContext(),
      requestB.provider.getVerifiedAdminContext(),
    ]);

    expect(contextA.ownerId).toBe('owner-a');
    expect(contextB.ownerId).toBe('owner-b');
    expect(requestA.query).toHaveBeenCalledTimes(1);
    expect(requestB.query).toHaveBeenCalledTimes(1);
  });

  it('caches admin context within a single request', async () => {
    const { provider, query } = createProvider({
      businessId: 'owner-a',
      row: {
        owner_id: 'owner-a',
        default_local_currency: 'USD',
        default_fiat_currency_for_crypto_conversions: 'USD',
        date_established: null,
        initial_accounter_year: null,
      },
    });

    const [first, second] = await Promise.all([
      provider.getVerifiedAdminContext(),
      provider.getVerifiedAdminContext(),
    ]);

    expect(first.ownerId).toBe('owner-a');
    expect(second.ownerId).toBe('owner-a');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('fails closed when auth context is unavailable (RLS guard path)', async () => {
    const { provider, query } = createProvider({
      businessId: null,
    });

    await expect(provider.getAdminContext()).rejects.toBeInstanceOf(GraphQLError);
    await expect(provider.getAdminContext()).rejects.toMatchObject({
      extensions: { code: 'UNAUTHENTICATED' },
    });
    expect(query).not.toHaveBeenCalled();
  });
});
