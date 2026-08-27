import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { AuthContextProvider } from '../providers/auth-context.provider.js';
import { membershipsResolvers } from '../resolvers/memberships.resolver.js';

const myMembershipsResolver = membershipsResolvers.Query?.myMemberships as (
  source: unknown,
  args: Record<string, never>,
  context: { injector: { get<T>(token: unknown): T } },
  info: GraphQLResolveInfo,
) => Promise<
  Array<{ id: string; businessId: string; roleId: string; businessName: string | null }>
>;

const mockInfo = {} as GraphQLResolveInfo;

/**
 * `load` stands in for the financial-entity DataLoader that supplies membership
 * business names. Defaults to "no row", i.e. an unnamed business.
 */
function contextWith(
  getAuthContext: ReturnType<typeof vi.fn>,
  load: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
) {
  const mockAuthProvider = { getAuthContext };
  const mockFinancialEntitiesProvider = { getFinancialEntityByIdLoader: { load } };
  return {
    injector: {
      get<T>(token: unknown): T {
        if (token === AuthContextProvider) {
          return mockAuthProvider as T;
        }
        if (token === FinancialEntitiesProvider) {
          return mockFinancialEntitiesProvider as T;
        }
        throw new Error('Unexpected provider requested');
      },
    },
  };
}

describe('myMemberships resolver', () => {
  it('returns all memberships for a multi-business user, resolving missing names', async () => {
    const getAuthContext = vi.fn().mockResolvedValue({
      authType: 'jwt',
      user: { userId: 'user-1' },
      tenant: { businessId: 'business-1', roleId: 'business_owner' },
      memberships: [
        { businessId: 'business-1', roleId: 'business_owner', businessName: 'Acme' },
        { businessId: 'business-2', roleId: 'accountant' },
      ],
    });
    // Only business-2 needs a lookup; business-1 already carries a name.
    const load = vi
      .fn()
      .mockImplementation(async (id: string) =>
        id === 'business-2' ? { id, name: 'Globex' } : { id, name: 'from-db' },
      );

    const result = await myMembershipsResolver({}, {}, contextWith(getAuthContext, load), mockInfo);

    expect(result).toEqual([
      {
        id: 'user-1:business-1',
        businessId: 'business-1',
        roleId: 'business_owner',
        // The auth context wins over the loader.
        businessName: 'Acme',
      },
      {
        id: 'user-1:business-2',
        businessId: 'business-2',
        roleId: 'accountant',
        businessName: 'Globex',
      },
    ]);
  });

  it('leaves a membership unnamed when its business row is unreadable, keeping the others', async () => {
    const getAuthContext = vi.fn().mockResolvedValue({
      authType: 'jwt',
      user: { userId: 'user-1' },
      tenant: { businessId: 'business-1', roleId: 'business_owner' },
      memberships: [
        { businessId: 'business-1', roleId: 'business_owner' },
        { businessId: 'business-2', roleId: 'accountant' },
      ],
    });
    // An out-of-scope business: RLS returns no row, or the load rejects outright.
    const load = vi.fn().mockImplementation(async (id: string) => {
      if (id === 'business-2') {
        throw new Error('out of scope');
      }
      return { id, name: 'Acme' };
    });

    const result = await myMembershipsResolver({}, {}, contextWith(getAuthContext, load), mockInfo);

    expect(result).toMatchObject([
      { businessId: 'business-1', businessName: 'Acme' },
      { businessId: 'business-2', businessName: null },
    ]);
  });

  it('leaves a membership unnamed when the business row carries no name', async () => {
    const getAuthContext = vi.fn().mockResolvedValue({
      authType: 'jwt',
      user: { userId: 'user-1' },
      tenant: { businessId: 'business-1', roleId: 'business_owner' },
      memberships: [{ businessId: 'business-1', roleId: 'business_owner' }],
    });
    const load = vi.fn().mockResolvedValue({ id: 'business-1', name: '' });

    const result = await myMembershipsResolver({}, {}, contextWith(getAuthContext, load), mockInfo);

    expect(result).toMatchObject([{ businessId: 'business-1', businessName: null }]);
  });

  it('returns an empty list for an authenticated user with no memberships', async () => {
    const getAuthContext = vi.fn().mockResolvedValue({
      authType: 'jwt',
      tenant: { businessId: '', roleId: undefined },
      memberships: [],
    });

    const result = await myMembershipsResolver({}, {}, contextWith(getAuthContext), mockInfo);

    expect(result).toEqual([]);
  });

  it('returns an empty list when the auth context has no memberships field', async () => {
    const getAuthContext = vi.fn().mockResolvedValue({
      authType: 'jwt',
      tenant: { businessId: 'business-1' },
    });

    const result = await myMembershipsResolver({}, {}, contextWith(getAuthContext), mockInfo);

    expect(result).toEqual([]);
  });

  it('wraps unexpected failures in a GraphQLError with the resolver code and original error', async () => {
    const originalError = new Error('db down');
    const getAuthContext = vi.fn().mockRejectedValue(originalError);

    const error = await myMembershipsResolver(
      {},
      {},
      contextWith(getAuthContext),
      mockInfo,
    ).then(
      () => {
        throw new Error('expected myMemberships to reject');
      },
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(GraphQLError);
    expect(error).toMatchObject({
      message: 'Failed to resolve memberships',
      extensions: { code: 'MEMBERSHIPS_RESOLUTION_FAILED' },
      originalError,
    });
  });

  it('rethrows GraphQLErrors from the auth context unchanged', async () => {
    const authError = new GraphQLError('Unauthenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
    const getAuthContext = vi.fn().mockRejectedValue(authError);

    await expect(
      myMembershipsResolver({}, {}, contextWith(getAuthContext), mockInfo),
    ).rejects.toBe(authError);
  });
});
