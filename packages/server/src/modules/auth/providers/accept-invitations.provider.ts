import { createHash } from 'node:crypto';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import {
  alreadyAcceptedError,
  expiredTokenError,
  invalidTokenError,
  mapAuth0Error,
} from '../helpers/invitations.helper.js';
import type {
  IGetInvitationByTokenQuery,
  IGetInvitationForAcceptanceQuery,
  IGetPendingBusinessUserForInvitationQuery,
  IGetUserIdByAuth0UserIdQuery,
  IInsertAcceptedBusinessUserQuery,
  IInsertAuditLogQuery,
  IUpdateBusinessUserAuth0IdQuery,
  IUpdateInvitationAcceptanceQuery,
} from '../types.js';
import { Auth0ManagementProvider } from './auth0-management.provider.js';

const updateInvitationAcceptance = sql<IUpdateInvitationAcceptanceQuery>`
  UPDATE accounter_schema.invitations
  SET accepted_at = NOW()
  WHERE id = $id;
`;

const getInvitationForAcceptance = sql<IGetInvitationForAcceptanceQuery>`
  SELECT id, business_id, role_id, auth0_user_id, accepted_at, expires_at
  FROM accounter_schema.invitations
  WHERE token_hash = $tokenHash
    AND accepted_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;
`;

const getInvitationByToken = sql<IGetInvitationByTokenQuery>`
  SELECT id, business_id, role_id, auth0_user_id, accepted_at, expires_at
  FROM accounter_schema.invitations
  WHERE token_hash = $tokenHash;
`;

const getUserIdByAuth0UserId = sql<IGetUserIdByAuth0UserIdQuery>`
  SELECT user_id
  FROM accounter_schema.business_users
  WHERE auth0_user_id = $auth0UserId
  LIMIT 1;
`;

const insertAcceptedBusinessUser = sql<IInsertAcceptedBusinessUserQuery>`
  INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
  VALUES ($userId, $auth0UserId, $ownerId, $roleId);
`;

const getPendingBusinessUserForInvitation = sql<IGetPendingBusinessUserForInvitationQuery>`
  SELECT user_id
  FROM accounter_schema.business_users
  WHERE business_id = $ownerId
    AND role_id = $roleId
    AND auth0_user_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
`;

const updateBusinessUserAuth0Id = sql<IUpdateBusinessUserAuth0IdQuery>`
  UPDATE accounter_schema.business_users
  SET auth0_user_id = $auth0UserId, updated_at = NOW()
  WHERE user_id = $userId
    AND business_id = $ownerId;
`;

const insertAuditLog = sql<IInsertAuditLogQuery>`
  INSERT INTO accounter_schema.audit_logs (
    business_id,
    user_id,
    auth0_user_id,
    action,
    entity,
    entity_id,
    details
  )
  VALUES ($ownerId, $userId, $auth0UserId, 'INVITATION_ACCEPTED', 'Invitation', $invitationId, $details::jsonb);
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AcceptInvitationsProvider {
  constructor(
    private dbProvider: DBProvider,
    private auth0ManagementProvider: Auth0ManagementProvider,
  ) {}

  public async acceptInvitation(token: string, auth0UserId: string | null) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const client = await this.dbProvider.pool.connect();

    try {
      await client.query('BEGIN');

      const activeInvitationResult = await getInvitationForAcceptance.run({ tokenHash }, client);

      if (activeInvitationResult.length === 0) {
        const invitationByTokenResult = await getInvitationByToken.run({ tokenHash }, client);

        if (invitationByTokenResult.length === 0) {
          throw invalidTokenError();
        }

        const staleInvitation = invitationByTokenResult[0];

        if (staleInvitation.accepted_at) {
          throw alreadyAcceptedError();
        }

        if (new Date(staleInvitation.expires_at).getTime() <= Date.now()) {
          throw expiredTokenError();
        }

        throw invalidTokenError();
      }

      const invitation = activeInvitationResult[0];
      const effectiveAuth0UserId = auth0UserId ?? invitation.auth0_user_id;

      if (!effectiveAuth0UserId) {
        throw invalidTokenError();
      }

      let userId: string;

      if (auth0UserId) {
        const existingUserResult = await getUserIdByAuth0UserId.run({ auth0UserId }, client);

        if ((existingUserResult.length ?? 0) > 0) {
          userId = existingUserResult[0].user_id;

          await insertAcceptedBusinessUser.run(
            {
              userId,
              auth0UserId: effectiveAuth0UserId,
              ownerId: invitation.business_id,
              roleId: invitation.role_id,
            },
            client,
          );
        } else {
          const pendingUserResult = await getPendingBusinessUserForInvitation.run(
            {
              ownerId: invitation.business_id,
              roleId: invitation.role_id,
            },
            client,
          );

          if (pendingUserResult.length === 0) {
            throw invalidTokenError();
          }

          userId = pendingUserResult[0].user_id;

          await updateBusinessUserAuth0Id.run(
            {
              auth0UserId: effectiveAuth0UserId,
              userId,
              ownerId: invitation.business_id,
            },
            client,
          );
        }
      } else {
        const pendingUserResult = await getPendingBusinessUserForInvitation.run(
          {
            ownerId: invitation.business_id,
            roleId: invitation.role_id,
          },
          client,
        );

        if (pendingUserResult.length === 0) {
          throw invalidTokenError();
        }

        userId = pendingUserResult[0].user_id;

        await updateBusinessUserAuth0Id.run(
          {
            auth0UserId: effectiveAuth0UserId,
            userId,
            ownerId: invitation.business_id,
          },
          client,
        );
      }

      if (invitation.auth0_user_id) {
        try {
          await this.auth0ManagementProvider.unblockUser(invitation.auth0_user_id);
        } catch (error) {
          throw mapAuth0Error(error);
        }
      }

      await updateInvitationAcceptance.run({ id: invitation.id }, client);

      await insertAuditLog.run(
        {
          ownerId: invitation.business_id,
          userId,
          auth0UserId: effectiveAuth0UserId,
          invitationId: invitation.id,
          details: {
            auth0_user_id: effectiveAuth0UserId,
            business_id: invitation.business_id,
            role_id: invitation.role_id,
          },
        },
        client,
      );

      await client.query('COMMIT');

      return {
        success: true,
        businessId: invitation.business_id,
        roleId: invitation.role_id,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }
}
