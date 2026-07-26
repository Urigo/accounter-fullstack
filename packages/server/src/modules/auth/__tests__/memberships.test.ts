import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
import { AuthContextProvider } from '../providers/auth-context.provider.js';
import { membershipsResolvers } from '../resolvers/memberships.resolver.js';

const myMembershipsResolver = membershipsResolvers.Query?.myMemberships as (
  source: unknown,
  args: Record<string, never>,
  context: { injector: { get<T>(token: unknown): T } },
  info: GraphQLResolveInfo,
) => Promise<Array<{ businessId: string; roleId: string; businessName: string | null }>>;

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
      tenant: { businessId: 'business-1', roleId: 'business_owner' },
      memberships: [
        { businessId: 'business-1', roleId: 'business_owner', businessName: 'Acme' },
        { businessId: 'business-2', roleId: 'accountant' },
      ],
    });

    const result = await myMembershipsResolver({}, {}, contextWith(getAuthContext), mockInfo);

    expect(result).toEqual([
      { businessId: 'business-1', roleId: 'business_owner', businessName: 'Acme' },
      { businessId: 'business-2', roleId: 'accountant', businessName: null },
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

  it('wraps unexpected failures in a GraphQLError', async () => {
    const getAuthContext = vi.fn().mockRejectedValue(new Error('db down'));

    await expect(
      myMembershipsResolver({}, {}, contextWith(getAuthContext), mockInfo),
    ).rejects.toBeInstanceOf(GraphQLError);
  });
});
