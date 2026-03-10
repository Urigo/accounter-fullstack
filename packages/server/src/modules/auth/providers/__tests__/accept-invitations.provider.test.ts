import { createHash } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pgTypedRuntimeMock = vi.hoisted(() => {
  const runMocks = Array.from({ length: 7 }, () => vi.fn());
  let sqlCallIndex = 0;

  return {
    runMocks,
    sql: vi.fn(() => ({ run: runMocks[sqlCallIndex++] })),
    reset() {
      sqlCallIndex = 0;
      for (const runMock of runMocks) {
        runMock.mockReset();
      }
    },
  };
});

vi.mock('@pgtyped/runtime', () => ({
  sql: pgTypedRuntimeMock.sql,
}));

import { AcceptInvitationsProvider } from '../accept-invitations.provider.js';

const [
  updateInvitationAcceptanceRun,
  getInvitationForAcceptanceRun,
  getInvitationByTokenRun,
  getUserIdByAuth0UserIdRun,
  insertAcceptedBusinessUserRun,
  updateBusinessUserAuth0IdRun,
  insertAuditLogRun,
] = pgTypedRuntimeMock.runMocks;

function activeInvitation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    user_id: 'invited-user',
    business_id: 'business-1',
    role_id: 'employee',
    auth0_user_id: 'auth0|invitee',
    accepted_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe('AcceptInvitationsProvider', () => {
  let dbClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let dbProvider: { pool: { connect: ReturnType<typeof vi.fn> } };
  let auth0ManagementProvider: { unblockUser: ReturnType<typeof vi.fn> };
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
    };

    provider = new AcceptInvitationsProvider(dbProvider as any, auth0ManagementProvider as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inserts business user when authenticated caller already exists', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([activeInvitation()]);
    getUserIdByAuth0UserIdRun.mockResolvedValue([{ user_id: 'existing-user' }]);
    insertAcceptedBusinessUserRun.mockResolvedValue([]);
    updateInvitationAcceptanceRun.mockResolvedValue([]);
    insertAuditLogRun.mockResolvedValue([]);

    const result = await provider.acceptInvitation('token-1', 'auth0|caller');

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
    expect(auth0ManagementProvider.unblockUser).toHaveBeenCalledWith('auth0|invitee');
    expect(dbClient.release).toHaveBeenCalledOnce();
  });

  it('updates pending business user when caller is authenticated but not found in business_users', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([activeInvitation()]);
    getUserIdByAuth0UserIdRun.mockResolvedValue([]);
    updateBusinessUserAuth0IdRun.mockResolvedValue([]);
    updateInvitationAcceptanceRun.mockResolvedValue([]);
    insertAuditLogRun.mockResolvedValue([]);

    await provider.acceptInvitation('token-2', 'auth0|caller');

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
  });

  it('uses invitation auth0_user_id when caller is unauthenticated', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([
      activeInvitation({ auth0_user_id: 'auth0|from-invitation' }),
    ]);
    updateBusinessUserAuth0IdRun.mockResolvedValue([]);
    updateInvitationAcceptanceRun.mockResolvedValue([]);
    insertAuditLogRun.mockResolvedValue([]);

    await provider.acceptInvitation('token-3', null);

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
  });

  it('throws TOKEN_ALREADY_USED when invitation is already accepted', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([]);
    getInvitationByTokenRun.mockResolvedValue([
      activeInvitation({ accepted_at: new Date().toISOString() }),
    ]);

    await expect(provider.acceptInvitation('token-4', 'auth0|caller')).rejects.toMatchObject({
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

    await expect(provider.acceptInvitation('token-5', 'auth0|caller')).rejects.toMatchObject({
      extensions: { code: 'TOKEN_EXPIRED' },
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
  });

  it('rolls back and throws TOKEN_INVALID when no invitation can be accepted', async () => {
    getInvitationForAcceptanceRun.mockResolvedValue([]);
    getInvitationByTokenRun.mockResolvedValue([]);

    await expect(provider.acceptInvitation('token-6', 'auth0|caller')).rejects.toMatchObject({
      extensions: { code: 'TOKEN_INVALID' },
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(updateInvitationAcceptanceRun).not.toHaveBeenCalled();
    expect(insertAuditLogRun).not.toHaveBeenCalled();
  });

  it('rolls back and maps Auth0 unblock failures to GraphQLError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    getInvitationForAcceptanceRun.mockResolvedValue([activeInvitation()]);
    getUserIdByAuth0UserIdRun.mockResolvedValue([{ user_id: 'existing-user' }]);
    insertAcceptedBusinessUserRun.mockResolvedValue([]);
    auth0ManagementProvider.unblockUser.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(provider.acceptInvitation('token-7', 'auth0|caller')).rejects.toSatisfy(error => {
      return error instanceof GraphQLError && error.extensions?.code === 'AUTH0_ERROR';
    });

    expect(dbClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(updateInvitationAcceptanceRun).not.toHaveBeenCalled();
    expect(insertAuditLogRun).not.toHaveBeenCalled();
  });
});