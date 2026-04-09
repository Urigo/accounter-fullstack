import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { makeUUID } from '../demo-fixtures/helpers/deterministic-uuid.js';
import {
  seedDemoUsers,
  type SeedDemoUsersDBConnection,
} from '../demo-fixtures/helpers/seed-demo-users.js';

describe('seedDemoUsers', () => {
  const businessId = makeUUID('business', 'admin-business');
  const adminUserId = makeUUID('user', 'demo-admin');
  const accountantUserId = makeUUID('user', 'demo-accountant');

  const originalDemoAuth0UserId = process.env.DEMO_AUTH0_USER_ID;

  beforeEach(() => {
    process.env.DEMO_AUTH0_USER_ID = 'auth0|demo-admin';
  });

  afterEach(() => {
    if (originalDemoAuth0UserId === undefined) {
      delete process.env.DEMO_AUTH0_USER_ID;
    } else {
      process.env.DEMO_AUTH0_USER_ID = originalDemoAuth0UserId;
    }
  });

  it('inserts deterministic admin and accountant users with idempotent SQL', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 2 });
    const dbConnection: SeedDemoUsersDBConnection = { query };

    const result = await seedDemoUsers(dbConnection, businessId);

    expect(result).toEqual({
      adminUserId,
      accountantUserId,
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO accounter_schema.business_users'),
      [adminUserId, businessId, 'auth0|demo-admin', accountantUserId],
    );

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('(user_id, business_id, role_id, auth0_user_id)');
    expect(sql).toContain("($1, $2, 'business_owner', $3)");
    expect(sql).toContain("($4, $2, 'accountant', NULL)");
    expect(sql).toContain('ON CONFLICT (user_id, business_id) DO NOTHING');
  });

  it('uses null auth0_user_id when DEMO_AUTH0_USER_ID is not set', async () => {
    delete process.env.DEMO_AUTH0_USER_ID;

    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 2 });
    const dbConnection: SeedDemoUsersDBConnection = { query };

    await seedDemoUsers(dbConnection, businessId);

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      adminUserId,
      businessId,
      null,
      accountantUserId,
    ]);
  });
});
