import { createHash } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pgTypedRuntimeMock = vi.hoisted(() => {
  const runMocks = {
    updateInvitationAcceptanceRun: vi.fn(),
    getInvitationForAcceptanceRun: vi.fn(),
    getInvitationByTokenRun: vi.fn(),
    getUserIdByAuth0UserIdRun: vi.fn(),
    insertAcceptedBusinessUserRun: vi.fn(),
    updateBusinessUserAuth0IdRun: vi.fn(),
  };

  const sql = vi.fn((strings: TemplateStringsArray) => {
    const query = strings.join(' ');

    if (query.includes('SET accepted_at = NOW()')) {
      return { run: runMocks.updateInvitationAcceptanceRun };
    }
    if (query.includes('AND accepted_at IS NULL') && query.includes('FOR UPDATE')) {
      return { run: runMocks.getInvitationForAcceptanceRun };
    }
    if (query.includes('WHERE token_hash = $tokenHash;') && !query.includes('FOR UPDATE')) {
      return { run: runMocks.getInvitationByTokenRun };
    }
    if (query.includes('FROM accounter_schema.business_users') && query.includes('LIMIT 1')) {
      return { run: runMocks.getUserIdByAuth0UserIdRun };
    }
    if (query.includes('INSERT INTO accounter_schema.business_users')) {
      return { run: runMocks.insertAcceptedBusinessUserRun };
    }
    if (
      query.includes('UPDATE accounter_schema.business_users') &&
      query.includes('SET auth0_user_id = $auth0UserId')
    ) {
      return { run: runMocks.updateBusinessUserAuth0IdRun };
    }

    return { run: vi.fn() };
  });

  return {
    runMocks,
    sql,
    reset() {
      for (const runMock of Object.values(runMocks)) {
        runMock.mockReset();
      }
    },
  };
});

vi.mock('@pgtyped/runtime', () => ({
  sql: pgTypedRuntimeMock.sql,
}));

vi.mock('../../common/providers/audit-logs.provider.js', () => ({
  AuditLogsProvider: class {
    log = vi.fn();
  },
}));

import { AcceptInvitationsProvider } from '../accept-invitations.provider.js';

const [
  updateInvitationAcceptanceRun,
  getInvitationForAcceptanceRun,
  getInvitationByTokenRun,
  getUserIdByAuth0UserIdRun,
  insertAcceptedBusinessUserRun,
  updateBusinessUserAuth0IdRun,
] = [
  pgTypedRuntimeMock.runMocks.updateInvitationAcceptanceRun,
  pgTypedRuntimeMock.runMocks.getInvitationForAcceptanceRun,
  pgTypedRuntimeMock.runMocks.getInvitationByTokenRun,
  pgTypedRuntimeMock.runMocks.getUserIdByAuth0UserIdRun,
  pgTypedRuntimeMock.runMocks.insertAcceptedBusinessUserRun,
  pgTypedRuntimeMock.runMocks.updateBusinessUserAuth0IdRun,
];

function activeInvitation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    user_id: 'invited-user',
    business_id: 'business-1',
    role_id: 'employee',
    email: 'invitee@example.com',
    auth0_user_id: 'auth0|invitee',
    accepted_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe('AcceptInvitationsProvider', () => {
  let dbClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let dbProvider: { pool: { connect: ReturnType<typeof vi.fn> } };
  let auth0ManagementProvider: {
    unblockUser: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };
  let provider: AcceptInvitationsProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    pgTypedRuntimeMock.reset();
    pgTypedRuntimeMock.sql.mockClear();

    dbClient = {
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };

    dbProvider = {
      pool: {
        connect: vi.fn().mockResolvedValue(dbClient),
      },
    };

    auth0ManagementProvider = {
      unblockUser: vi.fn().mockResolvedValue(undefined),
      deleteUser: vi.fn().mockResolvedValue(undefined),
    };

    provider = new AcceptInvitationsProvider(dbProvider as any, auth0ManagementProvider as any, {log: () => {void 0}} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inserts business user when authenticated caller already exists', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([activeInvitation()]);
    getUserIdByAuth0UserIdRun.mockResolvedValue([{ user_id: 'existing-user' }]);
    insertAcceptedBusinessUserRun.mockResolvedValue([]);
    updateInvitationAcceptanceRun.mockResolvedValue([]);

    const result = await provider.acceptInvitation('token-1', 'auth0|caller', 'invitee@example.com');

    expect(result).toEqual({
      success: true,
      businessId: 'business-1',
      roleId: 'employee',
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(getInvitationForAcceptanceRun).toHaveBeenCalledWith(
      {
        tokenHash: createHash('sha256').update('token-1').digest('hex'),
      },
      dbClient,
    );
    expect(insertAcceptedBusinessUserRun).toHaveBeenCalledWith(
      {
        userId: 'existing-user',
        auth0UserId: 'auth0|caller',
        ownerId: 'business-1',
        roleId: 'employee',
      },
      dbClient,
    );
    expect(updateBusinessUserAuth0IdRun).not.toHaveBeenCalled();
    expect(auth0ManagementProvider.deleteUser).toHaveBeenCalledWith('auth0|invitee');
    expect(auth0ManagementProvider.unblockUser).not.toHaveBeenCalled();
    expect(dbClient.release).toHaveBeenCalledOnce();
  });

  it('updates pending business user when caller is authenticated but not found in business_users', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([activeInvitation()]);
    getUserIdByAuth0UserIdRun.mockResolvedValue([]);
    updateBusinessUserAuth0IdRun.mockResolvedValue([]);
    updateInvitationAcceptanceRun.mockResolvedValue([]);

    await provider.acceptInvitation('token-2', 'auth0|caller', 'invitee@example.com');

    expect(updateBusinessUserAuth0IdRun).toHaveBeenCalledWith(
      {
        auth0UserId: 'auth0|caller',
        userId: 'invited-user',
        ownerId: 'business-1',
      },
      dbClient,
    );
    expect(insertAcceptedBusinessUserRun).not.toHaveBeenCalled();
    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(auth0ManagementProvider.deleteUser).toHaveBeenCalledWith('auth0|invitee');
    expect(auth0ManagementProvider.unblockUser).not.toHaveBeenCalled();
  });

  it('uses invitation auth0_user_id when caller is unauthenticated', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([
      activeInvitation({ auth0_user_id: 'auth0|from-invitation' }),
    ]);
    updateBusinessUserAuth0IdRun.mockResolvedValue([]);
    updateInvitationAcceptanceRun.mockResolvedValue([]);

    await provider.acceptInvitation('token-3', null, null);

    expect(getUserIdByAuth0UserIdRun).not.toHaveBeenCalled();
    expect(updateBusinessUserAuth0IdRun).toHaveBeenCalledWith(
      {
        auth0UserId: 'auth0|from-invitation',
        userId: 'invited-user',
        ownerId: 'business-1',
      },
      dbClient,
    );
    expect(auth0ManagementProvider.unblockUser).toHaveBeenCalledWith('auth0|from-invitation');
    expect(auth0ManagementProvider.deleteUser).not.toHaveBeenCalled();
  });

  it('unblocks invitation auth0 user when authenticated caller matches invitation auth0_user_id', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([
      activeInvitation({ auth0_user_id: 'auth0|same-user' }),
    ]);
    getUserIdByAuth0UserIdRun.mockResolvedValue([{ user_id: 'existing-user' }]);
    insertAcceptedBusinessUserRun.mockResolvedValue([]);
    updateInvitationAcceptanceRun.mockResolvedValue([]);

    await provider.acceptInvitation('token-same', 'auth0|same-user', 'invitee@example.com');

    expect(auth0ManagementProvider.unblockUser).toHaveBeenCalledWith('auth0|same-user');
    expect(auth0ManagementProvider.deleteUser).not.toHaveBeenCalled();
  });

  it('throws TOKEN_ALREADY_USED when invitation is already accepted', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([]);
    getInvitationByTokenRun.mockResolvedValue([
      activeInvitation({ accepted_at: new Date().toISOString() }),
    ]);

    await expect(
      provider.acceptInvitation('token-4', 'auth0|caller', 'invitee@example.com'),
    ).rejects.toMatchObject({
      extensions: { code: 'TOKEN_ALREADY_USED' },
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(dbClient.release).toHaveBeenCalledOnce();
  });

  it('throws TOKEN_EXPIRED when invitation is expired', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([]);
    getInvitationByTokenRun.mockResolvedValue([
      activeInvitation({ expires_at: new Date(Date.now() - 60_000).toISOString() }),
    ]);

    await expect(
      provider.acceptInvitation('token-5', 'auth0|caller', 'invitee@example.com'),
    ).rejects.toMatchObject({
      extensions: { code: 'TOKEN_EXPIRED' },
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
  });

  it('rolls back and throws TOKEN_INVALID when no invitation can be accepted', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([]);
    getInvitationByTokenRun.mockResolvedValue([]);

    await expect(
      provider.acceptInvitation('token-6', 'auth0|caller', 'invitee@example.com'),
    ).rejects.toMatchObject({
      extensions: { code: 'TOKEN_INVALID' },
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(updateInvitationAcceptanceRun).not.toHaveBeenCalled();
  });

  it('rolls back and maps Auth0 cleanup failures to GraphQLError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    getInvitationForAcceptanceRun.mockResolvedValue([activeInvitation()]);
    getUserIdByAuth0UserIdRun.mockResolvedValue([{ user_id: 'existing-user' }]);
    insertAcceptedBusinessUserRun.mockResolvedValue([]);
    auth0ManagementProvider.deleteUser.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(
      provider.acceptInvitation('token-7', 'auth0|caller', 'invitee@example.com'),
    ).rejects.toSatisfy(error => {
      return error instanceof GraphQLError && error.extensions?.code === 'AUTH0_ERROR';
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(updateInvitationAcceptanceRun).not.toHaveBeenCalled();
  });

  it('rejects authenticated claim when email does not match invitation email', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([activeInvitation({ email: 'invitee@example.com' })]);

    await expect(
      provider.acceptInvitation('token-8', 'auth0|caller', 'different@example.com'),
    ).rejects.toMatchObject({
      extensions: { code: 'TOKEN_INVALID' },
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(getUserIdByAuth0UserIdRun).not.toHaveBeenCalled();
    expect(updateBusinessUserAuth0IdRun).not.toHaveBeenCalled();
    expect(insertAcceptedBusinessUserRun).not.toHaveBeenCalled();
    expect(auth0ManagementProvider.unblockUser).not.toHaveBeenCalled();
    expect(auth0ManagementProvider.deleteUser).not.toHaveBeenCalled();
    expect(updateInvitationAcceptanceRun).not.toHaveBeenCalled();
  });
});