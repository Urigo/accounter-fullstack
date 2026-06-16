import { createHash, randomBytes, randomUUID } from 'node:crypto';
import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type { AuthContext, TenantContext } from '../../../shared/types/auth.js';
import type { NoOptionalField } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import type {
  IDeleteInvitationQuery,
  IDeletePendingInvitationPlaceholderQuery,
  IGetActiveInvitationsByEmailsQuery,
  IGetInvitationsByTokensQuery,
  IInsertInvitationParams,
  IInsertInvitationQuery,
  IListInvitationsQuery,
} from '../types.js';
import { AuthContextProvider } from './auth-context.provider.js';
import { BusinessUsersProvider } from './business-users.provider.js';

const INVITATION_EXPIRATION_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Validated auth context: business owner with a resolved tenant business id.
type ValidatedAuthContext = NoOptionalField<AuthContext, 'user'> & {
  tenant: NoOptionalField<TenantContext, 'businessId'>;
};

/** Stored invitation as listed for management (never exposes the one-time token). */
export type BusinessInvitationRecord = {
  id: string;
  email: string;
  roleId: string;
  expiresAt: Date;
};

const getActiveInvitationsByEmails = sql<IGetActiveInvitationsByEmailsQuery>`
  SELECT id, email
  FROM accounter_schema.invitations
  WHERE business_id = $ownerId
    AND lower(email) = ANY(SELECT lower(u) FROM unnest($emails::varchar[]) AS u)
    AND accepted_at IS NULL
    AND expires_at > NOW();`;

const getInvitationsByTokens = sql<IGetInvitationsByTokensQuery>`
  SELECT id, business_id, role_id, auth0_user_id, accepted_at, expires_at, token_hash
    FROM accounter_schema.invitations
    WHERE token_hash IN $$tokenHashes;`;

// Strictly tenant-scoped: only pending (not yet accepted) invitations for the
// current business are listed. The one-time token is never selected.
const listInvitations = sql<IListInvitationsQuery>`
  SELECT id, email, role_id, expires_at
  FROM accounter_schema.invitations
  WHERE business_id = $ownerId
    AND accepted_at IS NULL
  ORDER BY created_at DESC;
`;

// Strictly tenant-scoped: the business id guard prevents revoking an invitation
// that belongs to another tenant. Only pending invitations can be revoked.
const deleteInvitation = sql<IDeleteInvitationQuery>`
  DELETE FROM accounter_schema.invitations
  WHERE id = $invitationId
    AND business_id = $ownerId
    AND accepted_at IS NULL
  RETURNING id, user_id;
`;

// Removes the pending placeholder membership created alongside an invitation.
// Guarded by `auth0_user_id IS NULL` so an accepted member is never deleted.
const deletePendingInvitationPlaceholder = sql<IDeletePendingInvitationPlaceholderQuery>`
  DELETE FROM accounter_schema.business_users
  WHERE user_id = $userId
    AND business_id = $ownerId
    AND auth0_user_id IS NULL;
`;

const insertInvitation = sql<IInsertInvitationQuery>`
  INSERT INTO accounter_schema.invitations (
    user_id,
    business_id,
    email,
    role_id,
    token_hash,
    auth0_user_created,
    auth0_user_id,
    invited_by_user_id,
    invited_by_business_id,
    expires_at
  )
  VALUES ($userId, $ownerId, $email, $roleId, $tokenHash, $auth0UserCreated, $auth0UserId, $invitedByUserId, $invitedByBusinessId, $expiresAt)
  RETURNING id, email, business_id, role_id, expires_at;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class InvitationsProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
    private businessUsersProvider: BusinessUsersProvider,
    private auditLogsProvider: AuditLogsProvider,
    private authContextProvider: AuthContextProvider,
  ) {}

  private async batchInvitationsByEmails(emails: readonly string[]) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const invitations = await getActiveInvitationsByEmails.run(
      {
        emails: [...emails],
        ownerId,
      },
      this.db,
    );
    return emails.map(email =>
      invitations.filter(t => t.email.toLowerCase() === email.toLowerCase()),
    );
  }

  public getInvitationByEmailLoader = new DataLoader(
    (emails: readonly string[]) => this.batchInvitationsByEmails(emails),
    {
      cacheKeyFn: email => email.toLowerCase(),
    },
  );

  private async batchInvitationsByTokens(tokenHashes: readonly string[]) {
    const invitations = await getInvitationsByTokens.run(
      {
        tokenHashes: [...tokenHashes],
      },
      this.db,
    );
    return tokenHashes.map(tokenHash => invitations.filter(t => t.token_hash === tokenHash));
  }

  public getInvitationByTokensLoader = new DataLoader((tokenHashes: readonly string[]) =>
    this.batchInvitationsByTokens(tokenHashes),
  );

  public async insertInvitation({
    email,
    roleId,
    auth0UserId,
    invitedByUserId,
    ownerId,
  }: {
    email: string;
    roleId: string;
    auth0UserId: string;
    invitedByUserId: string;
    ownerId: string;
  }) {
    return this.db.transaction(async client => {
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const localUserId = randomUUID();

      const invitationParams: IInsertInvitationParams = {
        userId: localUserId,
        email,
        roleId,
        tokenHash,
        auth0UserCreated: true,
        auth0UserId,
        invitedByUserId,
        invitedByBusinessId: ownerId,
        ownerId,
        expiresAt: new Date(Date.now() + INVITATION_EXPIRATION_PERIOD_MS),
      };

      await this.businessUsersProvider.insertBusinessUser({
        userId: localUserId,
        auth0UserId: null,
        roleId,
        ownerId,
      });

      const insertedInvitation = await insertInvitation.run(invitationParams, client);

      const [invitation] = insertedInvitation;
      if (!invitation) {
        throw new GraphQLError('Invitation creation failed: no record returned from DB.', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      await this.auditLogsProvider.insertAuditLog({
        ownerId: invitation.business_id,
        userId: invitedByUserId,
        auth0UserId,
        action: 'INVITATION_CREATED',
        entity: 'Invitation',
        entityId: invitation.id,
        details: { email, roleId, auth0UserId },
      });

      return {
        id: invitation.id,
        email: invitation.email,
        roleId: invitation.role_id,
        expiresAt: invitation.expires_at,
        token,
      };
    });
  }

  /**
   * List the pending invitations for the current business.
   * Restricted to business owners and strictly scoped to the caller's tenant.
   * The one-time invitation token is never exposed.
   */
  public async listInvitations(): Promise<BusinessInvitationRecord[]> {
    const authContext = await this.requireBusinessOwner();

    const rows = await listInvitations.run({ ownerId: authContext.tenant.businessId }, this.db);

    return rows.map(row => ({
      id: row.id,
      email: row.email,
      roleId: row.role_id,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Revoke (hard-delete) a pending invitation.
   * Restricted to business owners and strictly scoped to the caller's tenant, so
   * an invitation belonging to another business can never be revoked. Already
   * accepted invitations are not revocable. The pending placeholder membership
   * created alongside the invitation is removed too, so it does not linger as a
   * ghost user. The Auth0 user is intentionally left untouched: the same blocked
   * user may be shared by invitations across businesses (and is reused on
   * re-invite), so deleting it here could break unrelated tenants.
   * Returns false when no matching pending invitation exists in the current business.
   */
  public async revokeInvitation(invitationId: string): Promise<boolean> {
    const authContext = await this.requireBusinessOwner();
    const ownerId = authContext.tenant.businessId;

    return this.db.transaction(async client => {
      const deleted = await deleteInvitation.run({ invitationId, ownerId }, client);
      const [invitation] = deleted;
      if (!invitation) {
        return false;
      }

      await deletePendingInvitationPlaceholder.run({ userId: invitation.user_id, ownerId }, client);

      await this.auditLogsProvider.log(
        {
          ownerId,
          userId: authContext.user.userId,
          auth0UserId: authContext.user.auth0UserId ?? undefined,
          action: 'INVITATION_REVOKED',
          entity: 'Invitation',
          entityId: invitation.id,
          details: { revoked: true },
        },
        client,
      );

      return true;
    });
  }

  private async requireBusinessOwner(): Promise<ValidatedAuthContext> {
    const authContext = await this.authContextProvider.getAuthContext();

    if (!authContext) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { user, tenant, ...restOfAuthContext } = authContext;

    if (!tenant?.businessId) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (user.roleId !== 'business_owner') {
      throw new GraphQLError('Requires role: business_owner', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return { ...restOfAuthContext, user, tenant };
  }
}
