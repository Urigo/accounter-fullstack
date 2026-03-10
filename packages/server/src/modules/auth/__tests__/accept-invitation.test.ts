import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invitationsResolvers } from '../resolvers/invitations.resolver.js';
import { AcceptInvitationsProvider } from '../providers/accept-invitations.provider.js';
import { AuthContextProvider } from '../providers/auth-context.provider.js';

const acceptInvitation = invitationsResolvers.Mutation?.acceptInvitation as (
  source: unknown,
  args: { token: string },
  context: { injector: { get<T>(token: unknown): T } },
  info: GraphQLResolveInfo,
) => Promise<{
  success: boolean;
  businessId: string;
  roleId: string;
}>;

const mockInfo = {} as GraphQLResolveInfo;

describe('acceptInvitation resolver', () => {
  let mockAuthProvider: { getAuthContext: ReturnType<typeof vi.fn> };
  let mockAcceptInvitationsProvider: { acceptInvitation: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthProvider = {
      getAuthContext: vi.fn().mockResolvedValue({
        authType: 'jwt',
        user: {
          userId: 'caller-user-id',
          roleId: 'employee',
          email: 'invitee@example.com',
          permissions: [],
          emailVerified: true,
          permissionsVersion: 1,
          auth0UserId: 'auth0|caller-123',
        },
        tenant: {
          businessId: 'business-123',
          roleId: 'employee',
        },
      }),
    };

    mockAcceptInvitationsProvider = {
      acceptInvitation: vi.fn().mockResolvedValue({
        success: true,
        businessId: 'business-abc',
        roleId: 'employee',
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createContext() {
    return {
      injector: {
        get<T>(token: unknown): T {
          if (token === AuthContextProvider) {
            return mockAuthProvider as T;
          }
          if (token === AcceptInvitationsProvider) {
            return mockAcceptInvitationsProvider as T;
          }
          throw new Error(`Unexpected token requested: ${String(token)}`);
        },
      },
    };
  }

  it('delegates to AcceptInvitationsProvider and returns payload', async () => {
    const result = await acceptInvitation({}, { token: 'token-1' }, createContext(), mockInfo);

    expect(result).toEqual({
      success: true,
      businessId: 'business-abc',
      roleId: 'employee',
    });
    expect(mockAcceptInvitationsProvider.acceptInvitation).toHaveBeenCalledWith(
      'token-1',
      'auth0|caller-123',
      'invitee@example.com',
    );
  });

  it('trims token before delegation', async () => {
    await acceptInvitation({}, { token: '  token-1  ' }, createContext(), mockInfo);

    expect(mockAcceptInvitationsProvider.acceptInvitation).toHaveBeenCalledWith(
      'token-1',
      'auth0|caller-123',
      'invitee@example.com',
    );
  });

  it('empty token rejected with TOKEN_INVALID', async () => {
    await expect(
      acceptInvitation({}, { token: '   ' }, createContext(), mockInfo),
    ).rejects.toSatisfy(error => {
      return error instanceof GraphQLError && error.extensions?.code === 'TOKEN_INVALID';
    });

    expect(mockAcceptInvitationsProvider.acceptInvitation).not.toHaveBeenCalled();
  });

  it('unauthenticated user delegates with null auth0UserId', async () => {
    mockAuthProvider.getAuthContext.mockResolvedValueOnce(null);

    await acceptInvitation({}, { token: 'token-3' }, createContext(), mockInfo);

    expect(mockAcceptInvitationsProvider.acceptInvitation).toHaveBeenCalledWith('token-3', null, null);
  });

  it('passes through GraphQLError from provider', async () => {
    mockAcceptInvitationsProvider.acceptInvitation.mockRejectedValueOnce(
      new GraphQLError('Invitation token expired', {
        extensions: { code: 'TOKEN_EXPIRED' },
      }),
    );

    await expect(
      acceptInvitation({}, { token: 'expired-token' }, createContext(), mockInfo),
    ).rejects.toSatisfy(error => {
      return error instanceof GraphQLError && error.extensions?.code === 'TOKEN_EXPIRED';
    });
  });

  it('wraps non-GraphQLError failures as INVITATION_ACCEPT_FAILED', async () => {
    mockAcceptInvitationsProvider.acceptInvitation.mockRejectedValueOnce(new Error('boom'));

    await expect(
      acceptInvitation({}, { token: 'token-rollback' }, createContext(), mockInfo),
    ).rejects.toSatisfy(error => {
      return error instanceof GraphQLError && error.extensions?.code === 'INVITATION_ACCEPT_FAILED';
    });
  });
});
