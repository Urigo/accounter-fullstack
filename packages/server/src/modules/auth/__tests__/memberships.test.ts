import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
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

function contextWith(getAuthContext: ReturnType<typeof vi.fn>) {
  const mockAuthProvider = { getAuthContext };
  return {
    injector: {
      get<T>(token: unknown): T {
        if (token === AuthContextProvider) {
          return mockAuthProvider as T;
        }
        throw new Error('Unexpected provider requested');
      },
    },
  };
}

describe('myMemberships resolver', () => {
  it('returns all memberships for a multi-business user', async () => {
    const getAuthContext = vi.fn().mockResolvedValue({
      authType: 'jwt',
      user: { userId: 'user-1' },
      tenant: { businessId: 'business-1', roleId: 'business_owner' },
      memberships: [
        { businessId: 'business-1', roleId: 'business_owner', businessName: 'Acme' },
        { businessId: 'business-2', roleId: 'accountant' },
      ],
    });

    const result = await myMembershipsResolver({}, {}, contextWith(getAuthContext), mockInfo);

    expect(result).toEqual([
      {
        id: 'user-1:business-1',
        businessId: 'business-1',
        roleId: 'business_owner',
        businessName: 'Acme',
      },
      {
        id: 'user-1:business-2',
        businessId: 'business-2',
        roleId: 'accountant',
        businessName: null,
      },
    ]);
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
