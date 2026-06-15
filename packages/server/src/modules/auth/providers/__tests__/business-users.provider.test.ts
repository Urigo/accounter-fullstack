import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessUsersProvider } from '../business-users.provider.js';

function buildProvider(loadedRows: Array<{ business_id: string; role_id: string }>) {
  const provider = new BusinessUsersProvider(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  (provider as unknown as { getBusinessUsersByAuth0IdsLoader: { load: ReturnType<typeof vi.fn> } }).getBusinessUsersByAuth0IdsLoader =
    { load: vi.fn().mockResolvedValue(loadedRows) };
  return provider;
}

describe('BusinessUsersProvider.getMembershipsByAuth0UserId', () => {
  it('returns an empty array for a user with no memberships', async () => {
    const provider = buildProvider([]);
    await expect(provider.getMembershipsByAuth0UserId('auth0|none')).resolves.toEqual([]);
  });

  it('returns a single membership', async () => {
    const provider = buildProvider([{ business_id: 'b-1', role_id: 'business_owner' }]);
    await expect(provider.getMembershipsByAuth0UserId('auth0|one')).resolves.toEqual([
      { businessId: 'b-1', roleId: 'business_owner' },
    ]);
  });

  it('returns all memberships for a multi-business user', async () => {
    const provider = buildProvider([
      { business_id: 'b-1', role_id: 'business_owner' },
      { business_id: 'b-2', role_id: 'accountant' },
    ]);
    await expect(provider.getMembershipsByAuth0UserId('auth0|many')).resolves.toEqual([
      { businessId: 'b-1', roleId: 'business_owner' },
      { businessId: 'b-2', roleId: 'accountant' },
    ]);
  });
});

const OWNER_BUSINESS_ID = 'business-123';

function ownerAuthContext() {
  return {
    authType: 'jwt',
    token: 'owner-token',
    user: {
      userId: 'owner-user-id',
      roleId: 'business_owner',
      email: 'owner@example.com',
      auth0UserId: 'auth0|owner-user-id',
      permissions: [],
      emailVerified: true,
      permissionsVersion: 1,
    },
    tenant: {
      businessId: OWNER_BUSINESS_ID,
      roleId: 'business_owner',
    },
  };
}

describe('BusinessUsersProvider.listBusinessUsers', () => {
  let mockDb: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  let mockAuthProvider: { getAuthContext: ReturnType<typeof vi.fn> };
  let mockAuth0Provider: { getUserProfileById: ReturnType<typeof vi.fn> };
  let mockAuditProvider: { log: ReturnType<typeof vi.fn> };

  function buildManagementProvider() {
    return new BusinessUsersProvider(
      mockDb as never,
      mockAuthProvider as never,
      mockAuth0Provider as never,
      mockAuditProvider as never,
    );
  }

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn().mockImplementation(async callback => callback(mockDb)),
    };
    mockAuthProvider = {
      getAuthContext: vi.fn().mockResolvedValue(ownerAuthContext()),
    };
    mockAuth0Provider = {
      getUserProfileById: vi.fn().mockResolvedValue(null),
    };
    mockAuditProvider = {
      log: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('enriches users with Auth0 identity and scopes the query to the caller tenant', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'user-1',
          auth0_user_id: 'auth0|user-1',
          role_id: 'accountant',
          created_at: new Date('2030-02-01T00:00:00.000Z'),
          fallback_email: 'invited-1@example.com',
        },
      ],
      rowCount: 1,
    });
    mockAuth0Provider.getUserProfileById.mockResolvedValueOnce({
      email: 'auth0-1@example.com',
      name: 'Ada Lovelace',
    });

    const provider = buildManagementProvider();
    const result = await provider.listBusinessUsers();

    expect(result).toEqual([
      {
        id: 'user-1',
        email: 'auth0-1@example.com',
        name: 'Ada Lovelace',
        roleId: 'accountant',
        createdAt: new Date('2030-02-01T00:00:00.000Z'),
      },
    ]);

    // The list query must be scoped to the authenticated owner's business id.
    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const [, params] = mockDb.query.mock.calls[0];
    expect(params).toContain(OWNER_BUSINESS_ID);
  });

  it('falls back to the invitation email when no Auth0 identity is available', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'user-2',
          auth0_user_id: null,
          role_id: 'employee',
          created_at: new Date('2030-01-01T00:00:00.000Z'),
          fallback_email: 'invited-2@example.com',
        },
      ],
      rowCount: 1,
    });

    const provider = buildManagementProvider();
    const result = await provider.listBusinessUsers();

    expect(result).toEqual([
      {
        id: 'user-2',
        email: 'invited-2@example.com',
        name: null,
        roleId: 'employee',
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
      },
    ]);
    // No Auth0 lookup when the membership has no auth0_user_id.
    expect(mockAuth0Provider.getUserProfileById).not.toHaveBeenCalled();
  });

  it('rejects non-owners with FORBIDDEN and never queries the database', async () => {
    mockAuthProvider.getAuthContext.mockResolvedValueOnce({
      ...ownerAuthContext(),
      user: { ...ownerAuthContext().user, roleId: 'accountant' },
      tenant: { businessId: OWNER_BUSINESS_ID, roleId: 'accountant' },
    });

    const provider = buildManagementProvider();
    await expect(provider.listBusinessUsers()).rejects.toSatisfy(
      error => error instanceof Error && (error as any).extensions?.code === 'FORBIDDEN',
    );
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    mockAuthProvider.getAuthContext.mockResolvedValueOnce(null);

    const provider = buildManagementProvider();
    await expect(provider.listBusinessUsers()).rejects.toSatisfy(
      error => error instanceof Error && (error as any).extensions?.code === 'UNAUTHENTICATED',
    );
    expect(mockDb.query).not.toHaveBeenCalled();
  });
});

describe('BusinessUsersProvider.removeBusinessUser', () => {
  let mockDb: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  let mockAuthProvider: { getAuthContext: ReturnType<typeof vi.fn> };
  let mockAuth0Provider: { getUserProfileById: ReturnType<typeof vi.fn> };
  let mockAuditProvider: { log: ReturnType<typeof vi.fn> };

  function buildManagementProvider() {
    return new BusinessUsersProvider(
      mockDb as never,
      mockAuthProvider as never,
      mockAuth0Provider as never,
      mockAuditProvider as never,
    );
  }

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn().mockImplementation(async callback => callback(mockDb)),
    };
    mockAuthProvider = {
      getAuthContext: vi.fn().mockResolvedValue(ownerAuthContext()),
    };
    mockAuth0Provider = {
      getUserProfileById: vi.fn().mockResolvedValue(null),
    };
    mockAuditProvider = {
      log: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removes a membership scoped to the caller tenant and writes an audit log', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }], rowCount: 1 });

    const provider = buildManagementProvider();
    const removed = await provider.removeBusinessUser('user-1');

    expect(removed).toBe(true);

    // The delete must be scoped: both the target user id and the owner's business id.
    const [, params] = mockDb.query.mock.calls[0];
    expect(params).toContain('user-1');
    expect(params).toContain(OWNER_BUSINESS_ID);

    expect(mockAuditProvider.log).toHaveBeenCalledTimes(1);
    expect(mockAuditProvider.log.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        action: 'BUSINESS_USER_REMOVED',
        entity: 'BusinessUser',
        entityId: 'user-1',
        ownerId: OWNER_BUSINESS_ID,
        userId: 'owner-user-id',
      }),
    );
  });

  it('returns false (and writes no audit log) for a user outside the tenant scope', async () => {
    // A user id belonging to another business: the business_id guard matches no rows.
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const provider = buildManagementProvider();
    const removed = await provider.removeBusinessUser('user-in-other-business');

    expect(removed).toBe(false);
    expect(mockAuditProvider.log).not.toHaveBeenCalled();

    // Confirm the query was still constrained to the caller's own business id.
    const [, params] = mockDb.query.mock.calls[0];
    expect(params).toContain(OWNER_BUSINESS_ID);
  });

  it('rejects non-owners with FORBIDDEN and never deletes', async () => {
    mockAuthProvider.getAuthContext.mockResolvedValueOnce({
      ...ownerAuthContext(),
      user: { ...ownerAuthContext().user, roleId: 'employee' },
      tenant: { businessId: OWNER_BUSINESS_ID, roleId: 'employee' },
    });

    const provider = buildManagementProvider();
    await expect(provider.removeBusinessUser('user-1')).rejects.toSatisfy(
      error => error instanceof Error && (error as any).extensions?.code === 'FORBIDDEN',
    );
    expect(mockDb.query).not.toHaveBeenCalled();
    expect(mockAuditProvider.log).not.toHaveBeenCalled();
  });
});
