import { createHash, randomBytes, randomUUID } from 'node:crypto';
import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import type {
  IGetInvitationsByEmailsQuery,
  IInsertInvitationParams,
  IInsertInvitationQuery,
} from '../types.js';
import { BusinessUsersProvider } from './business-users.provider.js';

const INVITATION_EXPIRATION_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const getInvitationsByEmails = sql<IGetInvitationsByEmailsQuery>`
  SELECT id, email
  FROM accounter_schema.invitations
  WHERE business_id = $ownerId
    AND lower(email) = ANY(SELECT lower(u) FROM unnest($emails::varchar[]) AS u)
    AND accepted_at IS NULL
    AND expires_at > NOW();`;

const insertInvitation = sql<IInsertInvitationQuery>`
  INSERT INTO accounter_schema.invitations (
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
  VALUES ($ownerId, $email, $roleId, $tokenHash, $auth0UserCreated, $auth0UserId, $invitedByUserId, $invitedByBusinessId, $expiresAt)
  RETURNING id, email, role_id, expires_at;
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
    const invitations = await getInvitationsByEmails.run(
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
        email,
        roleId,
        tokenHash,
        auth0UserCreated: true,
        auth0UserId,
        invitedByUserId,
        invitedByBusinessId:
          ownerId ?? (await this.adminContextProvider.getVerifiedAdminContext()).ownerId,
        expiresAt: new Date(Date.now() + INVITATION_EXPIRATION_PERIOD_MS),
      };
      const insertedInvitation = await insertInvitation.run(invitationParams, client);

      const [invitation] = insertedInvitation;
      if (!invitation) {
        throw new GraphQLError('Invitation creation failed: no record returned from DB.', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      await this.businessUsersProvider.insertBusinessUser({
        userId: localUserId,
        auth0UserId: null,
        roleId,
      });

      await this.auditLogsProvider.insertAuditLog({
        userId: invitedByUserId,
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
      };
    });
  }
}
