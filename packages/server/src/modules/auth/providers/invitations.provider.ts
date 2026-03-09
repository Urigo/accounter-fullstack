import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetInvitationsByEmailsQuery,
  IInsertInvitationParams,
  IInsertInvitationQuery,
} from '../types.js';

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
  ) {}

  private async batchInvitationsByEmails(emails: readonly string[]) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const invitations = await getInvitationsByEmails.run(
      {
        emails: emails ? [...emails] : [],
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
  public async insertInvitation(params: IInsertInvitationParams) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertInvitation.run(reassureOwnerIdExists(params, ownerId), this.db);
  }
}
