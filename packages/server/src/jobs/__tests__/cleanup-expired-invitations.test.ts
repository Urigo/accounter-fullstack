import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupExpiredInvitations, type Logger } from '../cleanup-expired-invitations.js';
import type { DBProvider } from '../../modules/app-providers/db.provider.js';
import type { Auth0ManagementProvider } from '../../modules/auth/providers/auth0-management.provider.js';

type QueryResult<T = unknown> = {
  rows: T[];
  rowCount?: number;
};

describe('cleanupExpiredInvitations', () => {
  let mockQuery: ReturnType<typeof vi.fn<(query: string, values?: unknown[]) => Promise<QueryResult>>>;
  let mockRelease: ReturnType<typeof vi.fn>;
  let mockConnect: ReturnType<typeof vi.fn>;
  let mockDeleteUser: ReturnType<typeof vi.fn<(auth0UserId: string) => Promise<void>>>;
  let db: DBProvider;
  let auth0: Auth0ManagementProvider;
  let logger: Logger;

  beforeEach(() => {
    mockQuery = vi.fn();
    mockRelease = vi.fn();
    mockConnect = vi.fn().mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });

    db = {
      pool: {
        connect: mockConnect,
      },
    } as unknown as DBProvider;

    mockDeleteUser = vi.fn().mockResolvedValue(undefined);
    auth0 = {
      deleteUser: mockDeleteUser,
    } as unknown as Auth0ManagementProvider;

    logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
  });

  it('deletes expired invitations, orphaned business users, and writes audit logs', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-1',
            auth0_user_id: 'auth0|123',
            auth0_user_created: true,
            user_id: 'user-1',
          },
        ],
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await cleanupExpiredInvitations(db, auth0, logger);

    expect(result).toEqual({ deleted: 1, errors: 0 });
    expect(auth0.deleteUser).toHaveBeenCalledWith('auth0|123');

    const queries = mockQuery.mock.calls.map(([query]) => query);
    expect(queries.some(query => query.includes('DELETE FROM accounter_schema.business_users'))).toBe(
      true,
    );
    expect(queries.some(query => query.includes('DELETE FROM accounter_schema.invitations'))).toBe(
      true,
    );
    expect(queries.some(query => query.includes('INSERT INTO accounter_schema.audit_logs'))).toBe(
      true,
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM accounter_schema.business_users'),
      ['user-1'],
    );

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('does not attempt to delete Auth0 user when invitation has no Auth0 account', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-2',
            auth0_user_id: null,
            auth0_user_created: false,
            user_id: 'user-2',
          },
        ],
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await cleanupExpiredInvitations(db, auth0, logger);

    expect(result).toEqual({ deleted: 1, errors: 0 });
    expect(auth0.deleteUser).not.toHaveBeenCalled();
  });

  it('does not delete accepted invitations because selector excludes accepted rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await cleanupExpiredInvitations(db, auth0, logger);

    expect(result).toEqual({ deleted: 0, errors: 0 });
    expect(auth0.deleteUser).not.toHaveBeenCalled();

    const [selectorQuery] = mockQuery.mock.calls[0];
    expect(selectorQuery).toContain('WHERE accepted_at IS NULL');
  });

  it('does not delete non-expired invitations because selector only fetches expired rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await cleanupExpiredInvitations(db, auth0, logger);

    expect(result).toEqual({ deleted: 0, errors: 0 });
    expect(auth0.deleteUser).not.toHaveBeenCalled();

    const [selectorQuery] = mockQuery.mock.calls[0];
    expect(selectorQuery).toContain('AND expires_at < NOW()');
  });

  it('logs Auth0/API failures and continues processing remaining invitations', async () => {
    mockDeleteUser.mockRejectedValueOnce(new Error('Auth0 rate limit')).mockResolvedValueOnce(undefined);

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-fail',
            auth0_user_id: 'auth0|fail',
            auth0_user_created: true,
            user_id: 'user-fail',
          },
          {
            id: 'inv-ok',
            auth0_user_id: 'auth0|ok',
            auth0_user_created: true,
            user_id: 'user-ok',
          },
        ],
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await cleanupExpiredInvitations(db, auth0, logger);

    expect(result).toEqual({ deleted: 1, errors: 1 });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Failed to cleanup invitation',
      expect.objectContaining({ invitationId: 'inv-fail' }),
    );

    expect(mockQuery).toHaveBeenCalledWith(
      'DELETE FROM accounter_schema.invitations WHERE id = $1',
      ['inv-ok'],
    );
  });

  it('creates one audit log entry per cleaned invitation', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-1',
            auth0_user_id: 'auth0|1',
            auth0_user_created: true,
            user_id: 'user-1',
          },
          {
            id: 'inv-2',
            auth0_user_id: 'auth0|2',
            auth0_user_created: true,
            user_id: 'user-2',
          },
        ],
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await cleanupExpiredInvitations(db, auth0, logger);

    expect(result).toEqual({ deleted: 2, errors: 0 });

    const auditInsertCalls = mockQuery.mock.calls.filter(([query]) =>
      query.includes('INSERT INTO accounter_schema.audit_logs'),
    );
    expect(auditInsertCalls).toHaveLength(2);
  });
});
