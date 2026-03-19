import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { ALLOWED_ROLES } from '../helpers/invitations.helper.js';

const ROLE_LABELS: Record<string, string> = {
  business_owner: 'Admin',
  accountant: 'Member',
  employee: 'Member',
  viewer: 'Observer',
  scraper: 'Scraper',
};

function roleLabel(roleId: string): string {
  return ROLE_LABELS[roleId] ?? roleId;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class TeamProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  public async listTeamMembers() {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();

    const { rows } = await this.db.query<{
      user_id: string;
      auth0_user_id: string | null;
      role_id: string;
      created_at: Date;
      updated_at: Date;
      email: string | null;
    }>(
      `SELECT bu.user_id, bu.auth0_user_id, bu.role_id, bu.created_at, bu.updated_at,
              i.email
       FROM accounter_schema.business_users bu
       LEFT JOIN (
         SELECT DISTINCT ON (user_id) user_id, email
         FROM accounter_schema.invitations
         ORDER BY user_id, accepted_at DESC NULLS LAST
       ) i ON i.user_id = bu.user_id
       WHERE bu.business_id = $1
       ORDER BY bu.created_at ASC`,
      [ownerId],
    );

    return rows.map(row => ({
      id: row.user_id,
      userId: row.user_id,
      email: row.email,
      roleId: row.role_id,
      roleLabel: roleLabel(row.role_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  public async listPendingInvitations() {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();

    const { rows } = await this.db.query<{
      id: string;
      email: string;
      role_id: string;
      expires_at: Date;
      created_at: Date;
    }>(
      `SELECT id, email, role_id, expires_at, created_at
       FROM accounter_schema.invitations
       WHERE business_id = $1
         AND accepted_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [ownerId],
    );

    return rows.map(row => ({
      id: row.id,
      email: row.email,
      roleId: row.role_id,
      roleLabel: roleLabel(row.role_id),
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  public async removeTeamMember(userId: string) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();

    const { rowCount } = await this.db.query(
      `DELETE FROM accounter_schema.business_users
       WHERE user_id = $1 AND business_id = $2`,
      [userId, ownerId],
    );

    return (rowCount ?? 0) > 0;
  }

  public async revokeInvitation(invitationId: string) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();

    const { rowCount } = await this.db.query(
      `UPDATE accounter_schema.invitations
       SET expires_at = NOW()
       WHERE id = $1 AND business_id = $2 AND accepted_at IS NULL`,
      [invitationId, ownerId],
    );

    return (rowCount ?? 0) > 0;
  }

  public async updateTeamMemberRole(userId: string, newRoleId: string) {
    if (!ALLOWED_ROLES.has(newRoleId) || newRoleId === 'scraper') {
      throw new GraphQLError(`Invalid roleId: ${newRoleId}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();

    const { rows } = await this.db.query<{
      user_id: string;
      auth0_user_id: string | null;
      role_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE accounter_schema.business_users
       SET role_id = $1, updated_at = NOW()
       WHERE user_id = $2 AND business_id = $3
       RETURNING user_id, auth0_user_id, role_id, created_at, updated_at`,
      [newRoleId, userId, ownerId],
    );

    if (!rows.length) {
      throw new GraphQLError('Team member not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const row = rows[0];
    return {
      id: row.user_id,
      userId: row.user_id,
      email: null,
      roleId: row.role_id,
      roleLabel: roleLabel(row.role_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
