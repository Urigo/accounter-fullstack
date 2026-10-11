import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import type { AuditLogsProvider } from '../../../common/providers/audit-logs.provider.js';
import { AcceptInvitationsProvider } from '../accept-invitations.provider.js';
import type { Auth0ManagementProvider } from '../auth0-management.provider.js';

let pool: Pool;

// The existing member belongs to FIRST_BUSINESS and is invited to SECOND_BUSINESS.
const FIRST_BUSINESS_ID = '00000000-0000-0000-0000-0000000009a0';
const SECOND_BUSINESS_ID = '00000000-0000-0000-0000-0000000009af';
const EXISTING_USER_ID = '00000000-0000-4000-8000-0000000009b1';
const PLACEHOLDER_USER_ID = '00000000-0000-4000-8000-0000000009b2';
const EXISTING_AUTH0_USER_ID = 'auth0|accept-invitations-integration-existing';
const PLACEHOLDER_AUTH0_USER_ID = 'auth0|accept-invitations-integration-placeholder';
const INVITEE_EMAIL = 'accept-invitations-integration@example.com';
const TOKEN = 'accept-invitations-integration-token';

const auth0 = {
  unblockUser: vi.fn(),
  deleteUser: vi.fn(),
  isUnusedInvitationUser: vi.fn(),
  getUserEmailById: vi.fn(),
};

function createProvider() {
  return new AcceptInvitationsProvider(
    new DBProvider(pool),
    auth0 as unknown as Auth0ManagementProvider,
    { log: vi.fn() } as unknown as AuditLogsProvider,
  );
}

async function seedBusiness(id: string, name: string) {
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, $2, 'business', NULL)
     ON CONFLICT (id) DO NOTHING`,
    [id, name],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $1, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [id],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses_admin (id, owner_id)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [id],
  );
}

/** Invite the existing member to the second business, as `createInvitation` would. */
async function seedInvitation(auth0UserId: string, auth0UserCreated: boolean) {
  await pool.query(
    `INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
     VALUES ($1, NULL, $2, 'accountant')`,
    [PLACEHOLDER_USER_ID, SECOND_BUSINESS_ID],
  );
  const {
    rows: [invitation],
  } = await pool.query<{ id: string }>(
    `INSERT INTO accounter_schema.invitations
       (user_id, business_id, email, role_id, token_hash, auth0_user_created, auth0_user_id, expires_at)
     VALUES ($1, $2, $3, 'accountant', $4, $5, $6, now() + interval '1 day')
     RETURNING id`,
    [
      PLACEHOLDER_USER_ID,
      SECOND_BUSINESS_ID,
      INVITEE_EMAIL,
      createHash('sha256').update(TOKEN).digest('hex'),
      auth0UserCreated,
      auth0UserId,
    ],
  );
  return invitation.id;
}

async function getSecondBusinessMembers() {
  const { rows } = await pool.query<{ user_id: string; auth0_user_id: string | null }>(
    `SELECT user_id, auth0_user_id FROM accounter_schema.business_users
     WHERE business_id = $1
     ORDER BY user_id`,
    [SECOND_BUSINESS_ID],
  );
  return rows;
}

async function cleanup() {
  // Invitations cascade with their business_users row.
  await pool.query('DELETE FROM accounter_schema.business_users WHERE business_id = $1', [
    SECOND_BUSINESS_ID,
  ]);
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);

  await seedBusiness(FIRST_BUSINESS_ID, 'accept-invitations-integration-first');
  await seedBusiness(SECOND_BUSINESS_ID, 'accept-invitations-integration-second');
  await pool.query(
    `INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
     VALUES ($1, $2, $3, 'accountant')
     ON CONFLICT (user_id, business_id) DO NOTHING`,
    [EXISTING_USER_ID, EXISTING_AUTH0_USER_ID, FIRST_BUSINESS_ID],
  );
});

afterAll(async () => {
  await cleanup();
  for (const id of [FIRST_BUSINESS_ID, SECOND_BUSINESS_ID]) {
    // business_users rows cascade with businesses_admin.
    await pool.query('DELETE FROM accounter_schema.businesses_admin WHERE id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [id]);
  }
  // Do NOT close the shared pool here — it is shared with other concurrently-running suites.
});

beforeEach(async () => {
  vi.resetAllMocks();
  auth0.isUnusedInvitationUser.mockResolvedValue(true);
  await cleanup();
});

describe('AcceptInvitationsProvider (integration): existing member invited to a second business', () => {
  it('adds the membership, retires the placeholder and leaves the existing Auth0 user alone', async () => {
    // A real account in use, not an invitation placeholder.
    auth0.isUnusedInvitationUser.mockResolvedValue(false);
    const invitationId = await seedInvitation(EXISTING_AUTH0_USER_ID, false);

    const result = await createProvider().acceptInvitation(
      TOKEN,
      EXISTING_AUTH0_USER_ID,
      INVITEE_EMAIL,
    );

    expect(result).toEqual({
      success: true,
      businessId: SECOND_BUSINESS_ID,
      roleId: 'accountant',
    });
    expect(await getSecondBusinessMembers()).toEqual([
      { user_id: EXISTING_USER_ID, auth0_user_id: EXISTING_AUTH0_USER_ID },
    ]);

    const {
      rows: [invitation],
    } = await pool.query<{ user_id: string; accepted_at: Date | null }>(
      'SELECT user_id, accepted_at FROM accounter_schema.invitations WHERE id = $1',
      [invitationId],
    );
    expect(invitation.user_id).toBe(EXISTING_USER_ID);
    expect(invitation.accepted_at).not.toBeNull();

    expect(auth0.unblockUser).not.toHaveBeenCalled();
    expect(auth0.deleteUser).not.toHaveBeenCalled();
  });

  it('rejects a call without an authenticated user and changes nothing', async () => {
    const invitationId = await seedInvitation(EXISTING_AUTH0_USER_ID, false);

    await expect(
      createProvider().acceptInvitation(TOKEN, null as unknown as string, null),
    ).rejects.toMatchObject({ extensions: { code: 'TOKEN_INVALID' } });

    expect(await getSecondBusinessMembers()).toEqual([
      { user_id: PLACEHOLDER_USER_ID, auth0_user_id: null },
    ]);
    const {
      rows: [invitation],
    } = await pool.query<{ user_id: string; accepted_at: Date | null }>(
      'SELECT user_id, accepted_at FROM accounter_schema.invitations WHERE id = $1',
      [invitationId],
    );
    expect(invitation).toEqual({ user_id: PLACEHOLDER_USER_ID, accepted_at: null });
    expect(auth0.unblockUser).not.toHaveBeenCalled();
    expect(auth0.deleteUser).not.toHaveBeenCalled();
  });

  it('removes an unused placeholder Auth0 user the invitation created', async () => {
    await seedInvitation(PLACEHOLDER_AUTH0_USER_ID, true);

    await createProvider().acceptInvitation(TOKEN, EXISTING_AUTH0_USER_ID, INVITEE_EMAIL);

    expect(await getSecondBusinessMembers()).toEqual([
      { user_id: EXISTING_USER_ID, auth0_user_id: EXISTING_AUTH0_USER_ID },
    ]);
    expect(auth0.isUnusedInvitationUser).toHaveBeenCalledWith(PLACEHOLDER_AUTH0_USER_ID);
    expect(auth0.deleteUser).toHaveBeenCalledWith(PLACEHOLDER_AUTH0_USER_ID);
    expect(auth0.unblockUser).not.toHaveBeenCalled();
  });
});
