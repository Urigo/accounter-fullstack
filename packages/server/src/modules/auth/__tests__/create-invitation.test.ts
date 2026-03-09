import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import { invitationsResolvers } from '../resolvers/invitations.resolver.js';
import { AuthContextProvider } from '../providers/auth-context.provider.js';
import { Auth0ManagementProvider } from '../providers/auth0-management.provider.js';
import { BusinessUsersProvider } from '../providers/business-users.provider.js';
import { InvitationsProvider } from '../providers/invitations.provider.js';

const createInvitation = invitationsResolvers.Mutation?.createInvitation as (
  source: unknown,
  args: { email: string; roleId: string },
  context: { injector: { get<T>(token: unknown): T } },
  info: GraphQLResolveInfo,
) => Promise<{
  id: string;
  email: string;
  roleId: string;
  expiresAt: Date;
}>;

const mockInfo = {} as GraphQLResolveInfo;

describe('createInvitation resolver', () => {
  let mockAuthProvider: { getAuthContext: ReturnType<typeof vi.fn> };
  let mockAuth0ManagementProvider: { createBlockedUser: ReturnType<typeof vi.fn> };
  let mockInvitationsProvider: {
    getInvitationByEmailLoader: { load: ReturnType<typeof vi.fn> };
    insertInvitation: ReturnType<typeof vi.fn>;
  };
  let mockBusinessUsersProvider: { insertBusinessUser: ReturnType<typeof vi.fn> };
  let mockAuditLogsProvider: { insertAuditLog: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthProvider = {
      getAuthContext: vi.fn().mockResolvedValue({
        authType: 'jwt',
        user: {
          userId: 'user-123',
          roleId: 'business_owner',
          email: 'owner@example.com',
          permissions: [],
          emailVerified: true,
          permissionsVersion: 1,
          auth0UserId: 'auth0|owner-123',
        },
        tenant: {
          businessId: 'business-123',
          roleId: 'business_owner',
        },
      }),
    };

    mockAuth0ManagementProvider = {
      createBlockedUser: vi.fn().mockResolvedValue('auth0|new-user-123'),
    };

    mockInvitationsProvider = {
      getInvitationByEmailLoader: {
        load: vi.fn().mockResolvedValue([]),
      },
      insertInvitation: vi.fn().mockResolvedValue([
        {
          id: 'inv-123',
          email: 'new.user@example.com',
          role_id: 'employee',
          expires_at: new Date('2030-01-01T00:00:00.000Z'),
        },
      ]),
    };

    mockBusinessUsersProvider = {
      insertBusinessUser: vi.fn().mockResolvedValue([]),
    };

    mockAuditLogsProvider = {
      insertAuditLog: vi.fn().mockResolvedValue([]),
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
          if (token === Auth0ManagementProvider) {
            return mockAuth0ManagementProvider as T;
          }
          if (token === InvitationsProvider) {
            return mockInvitationsProvider as T;
          }
          if (token === BusinessUsersProvider) {
            return mockBusinessUsersProvider as T;
          }
          if (token === AuditLogsProvider) {
            return mockAuditLogsProvider as T;
          }
          throw new Error(`Unexpected token requested: ${String(token)}`);
        },
      },
    };
  }

  it('business_owner can create invitation (happy path)', async () => {
    const result = await createInvitation(
      {},
      { email: 'new.user@example.com', roleId: 'employee' },
      createContext(),
      mockInfo,
    );

    expect(result).toEqual({
      id: 'inv-123',
      email: 'new.user@example.com',
      roleId: 'employee',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
  });

  it('Auth0 Management API called with correct parameters (mock)', async () => {
    await createInvitation(
      {},
      { email: 'INVITEE@EXAMPLE.COM', roleId: 'scraper' },
      createContext(),
      mockInfo,
    );

    expect(mockAuth0ManagementProvider.createBlockedUser).toHaveBeenCalledWith('invitee@example.com');
  });

  it('invitation record inserted with correct fields', async () => {
    await createInvitation(
      {},
      { email: 'new.user@example.com', roleId: 'accountant' },
      createContext(),
      mockInfo,
    );

    expect(mockInvitationsProvider.insertInvitation).toHaveBeenCalledTimes(1);
    const call = mockInvitationsProvider.insertInvitation.mock.calls[0][0];
    expect(call.email).toBe('new.user@example.com');
    expect(call.roleId).toBe('accountant');
    expect(call.auth0UserCreated).toBe(true);
    expect(call.auth0UserId).toBe('auth0|new-user-123');
    expect(call.invitedByUserId).toBe('user-123');
    expect(call.invitedByBusinessId).toBe('business-123');
    expect(call.token).toMatch(/^[a-f0-9]{64}$/);
    expect(call.expiresAt).toBeInstanceOf(Date);
  });

  it('business_users row pre-created (auth0_user_id NULL)', async () => {
    await createInvitation(
      {},
      { email: 'new.user@example.com', roleId: 'employee' },
      createContext(),
      mockInfo,
    );

    expect(mockBusinessUsersProvider.insertBusinessUser).toHaveBeenCalledTimes(1);
    const call = mockBusinessUsersProvider.insertBusinessUser.mock.calls[0][0];
    expect(call.auth0UserId).toBeNull();
    expect(call.roleId).toBe('employee');
    expect(call.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('audit log entry created', async () => {
    mockInvitationsProvider.insertInvitation.mockResolvedValueOnce([
      {
        id: 'inv-audit',
        email: 'new.user@example.com',
        role_id: 'employee',
        expires_at: new Date('2030-05-01T00:00:00.000Z'),
      },
    ]);

    await createInvitation(
      {},
      { email: 'new.user@example.com', roleId: 'employee' },
      createContext(),
      mockInfo,
    );

    expect(mockAuditLogsProvider.insertAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLogsProvider.insertAuditLog).toHaveBeenCalledWith({
      userId: 'user-123',
      action: 'INVITATION_CREATED',
      entity: 'Invitation',
      entityId: 'inv-audit',
      details: {
        email: 'new.user@example.com',
        roleId: 'employee',
        auth0UserId: 'auth0|new-user-123',
      },
    });
  });

  it('duplicate active invitation rejected', async () => {
    mockInvitationsProvider.getInvitationByEmailLoader.load.mockResolvedValueOnce([
      {
        id: 'existing-invitation',
        email: 'new.user@example.com',
      },
    ]);

    await expect(
      createInvitation(
        {},
        { email: 'new.user@example.com', roleId: 'employee' },
        createContext(),
        mockInfo,
      ),
    ).rejects.toMatchObject({
      extensions: { code: 'INVITATION_ALREADY_PENDING' },
    });

    expect(mockAuth0ManagementProvider.createBlockedUser).not.toHaveBeenCalled();
    expect(mockInvitationsProvider.insertInvitation).not.toHaveBeenCalled();
  });

  it('Auth0 rate limit handled gracefully (mocked 429)', async () => {
    mockAuth0ManagementProvider.createBlockedUser.mockRejectedValue({
      statusCode: 429,
      retryAfter: 60,
      message: 'Too many requests',
    });

    await expect(
      createInvitation(
        {},
        { email: 'new.user@example.com', roleId: 'employee' },
        createContext(),
        mockInfo,
      ),
    ).rejects.toMatchObject({
      extensions: {
        code: 'RATE_LIMITED',
        retryAfter: 60,
      },
    });

    expect(mockInvitationsProvider.insertInvitation).not.toHaveBeenCalled();
  });

  it('Auth0 user already exists returns USER_ALREADY_EXISTS', async () => {
    mockAuth0ManagementProvider.createBlockedUser.mockRejectedValue({
      statusCode: 409,
      message: 'The user already exists',
    });

    await expect(
      createInvitation(
        {},
        { email: 'new.user@example.com', roleId: 'employee' },
        createContext(),
        mockInfo,
      ),
    ).rejects.toMatchObject({
      extensions: {
        code: 'USER_ALREADY_EXISTS',
      },
    });

    expect(mockInvitationsProvider.insertInvitation).not.toHaveBeenCalled();
  });

  it('employee calling mutation gets FORBIDDEN', async () => {
    mockAuthProvider.getAuthContext.mockResolvedValueOnce({
      authType: 'jwt',
      user: {
        userId: 'user-employee',
        roleId: 'employee',
        email: 'employee@example.com',
        permissions: [],
        emailVerified: true,
        permissionsVersion: 1,
        auth0UserId: 'auth0|employee',
      },
      tenant: {
        businessId: 'business-123',
        roleId: 'employee',
      },
    });

    await expect(
      createInvitation(
        {},
        { email: 'new.user@example.com', roleId: 'employee' },
        createContext(),
        mockInfo,
      ),
    ).rejects.toSatisfy(error => {
      return error instanceof GraphQLError && error.extensions?.code === 'FORBIDDEN';
    });

    expect(mockInvitationsProvider.insertInvitation).not.toHaveBeenCalled();
  });
});
