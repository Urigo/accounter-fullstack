import { createHash, randomBytes, randomUUID } from 'node:crypto';
import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import type {
  IGetActiveInvitationsByEmailsQuery,
  IGetInvitationsByTokensQuery,
  IInsertInvitationParams,
  IInsertInvitationQuery,
} from '../types.js';
import { BusinessUsersProvider } from './business-users.provider.js';

const INVITATION_EXPIRATION_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
}
