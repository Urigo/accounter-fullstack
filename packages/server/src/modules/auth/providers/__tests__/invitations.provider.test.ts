import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationsProvider } from '../invitations.provider.js';

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

describe('InvitationsProvider', () => {
  let mockDb: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  let mockAuthProvider: { getAuthContext: ReturnType<typeof vi.fn> };
  let mockAuditProvider: { log: ReturnType<typeof vi.fn> };

  function buildProvider() {
    return new InvitationsProvider(
      mockDb as never,
      {} as never, // AdminContextProvider (unused by these methods)
      {} as never, // BusinessUsersProvider (unused by these methods)
      mockAuditProvider as never,
      mockAuthProvider as never,
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
    mockAuditProvider = {
      log: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listInvitations', () => {
    it('returns pending invitations scoped to the caller tenant', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-2',
            email: 'newer@example.com',
            role_id: 'accountant',
            expires_at: new Date('2030-02-01T00:00:00.000Z'),
          },
          {
            id: 'inv-1',
            email: 'older@example.com',
            role_id: 'employee',
            expires_at: new Date('2030-01-01T00:00:00.000Z'),
          },
        ],
        rowCount: 2,
      });

      const provider = buildProvider();
      const result = await provider.listInvitations();

      expect(result).toEqual([
        {
          id: 'inv-2',
          email: 'newer@example.com',
          roleId: 'accountant',
          expiresAt: new Date('2030-02-01T00:00:00.000Z'),
        },
        {
          id: 'inv-1',
          email: 'older@example.com',
          roleId: 'employee',
          expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        },
      ]);

      // The list query must be scoped to the authenticated owner's business id.
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [, params] = mockDb.query.mock.calls[0];
      expect(params).toContain(OWNER_BUSINESS_ID);
    });

    it('rejects non-owners with FORBIDDEN and never queries the database', async () => {
      mockAuthProvider.getAuthContext.mockResolvedValueOnce({
        ...ownerAuthContext(),
        user: { ...ownerAuthContext().user, roleId: 'accountant' },
        tenant: { businessId: OWNER_BUSINESS_ID, roleId: 'accountant' },
      });

      const provider = buildProvider();
      await expect(provider.listInvitations()).rejects.toSatisfy(
        error => error instanceof Error && (error as any).extensions?.code === 'FORBIDDEN',
      );
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
      mockAuthProvider.getAuthContext.mockResolvedValueOnce(null);

      const provider = buildProvider();
      await expect(provider.listInvitations()).rejects.toSatisfy(
        error => error instanceof Error && (error as any).extensions?.code === 'UNAUTHENTICATED',
      );
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('revokeInvitation', () => {
    it('deletes a pending invitation, removes its placeholder, and writes an audit log', async () => {
      mockDb.query
        // deleteInvitation
        .mockResolvedValueOnce({ rows: [{ id: 'inv-1', user_id: 'placeholder-user' }], rowCount: 1 })
        // deletePendingInvitationPlaceholder
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const provider = buildProvider();
      const revoked = await provider.revokeInvitation('inv-1');

      expect(revoked).toBe(true);

      // The delete must be scoped to both the invitation id and the owner's business id.
      const [, deleteParams] = mockDb.query.mock.calls[0];
      expect(deleteParams).toContain('inv-1');
      expect(deleteParams).toContain(OWNER_BUSINESS_ID);

      // The placeholder cleanup must be scoped to the owner's business id too.
      const [, placeholderParams] = mockDb.query.mock.calls[1];
      expect(placeholderParams).toContain('placeholder-user');
      expect(placeholderParams).toContain(OWNER_BUSINESS_ID);

      expect(mockAuditProvider.log).toHaveBeenCalledTimes(1);
      expect(mockAuditProvider.log.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          action: 'INVITATION_REVOKED',
          entity: 'Invitation',
          entityId: 'inv-1',
          ownerId: OWNER_BUSINESS_ID,
          userId: 'owner-user-id',
        }),
      );
    });

    it('returns false (no placeholder delete, no audit) for an invitation outside the tenant scope', async () => {
      // An invitation id belonging to another business: the business_id guard matches no rows.
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const provider = buildProvider();
      const revoked = await provider.revokeInvitation('inv-in-other-business');

      expect(revoked).toBe(false);
      // Only the scoped delete attempt ran; no placeholder cleanup, no audit log.
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockAuditProvider.log).not.toHaveBeenCalled();

      const [, params] = mockDb.query.mock.calls[0];
      expect(params).toContain(OWNER_BUSINESS_ID);
    });

    it('rejects non-owners with FORBIDDEN and never deletes', async () => {
      mockAuthProvider.getAuthContext.mockResolvedValueOnce({
        ...ownerAuthContext(),
        user: { ...ownerAuthContext().user, roleId: 'employee' },
        tenant: { businessId: OWNER_BUSINESS_ID, roleId: 'employee' },
      });

      const provider = buildProvider();
      await expect(provider.revokeInvitation('inv-1')).rejects.toSatisfy(
        error => error instanceof Error && (error as any).extensions?.code === 'FORBIDDEN',
      );
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockAuditProvider.log).not.toHaveBeenCalled();
    });
  });
});
