import { DBProvider } from '../modules/app-providers/db.provider.js';
import { Auth0ManagementProvider } from '../modules/auth/providers/auth0-management.provider.js';

export interface Logger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export async function cleanupExpiredInvitations(
  db: DBProvider,
  auth0: Auth0ManagementProvider,
  logger: Logger,
): Promise<{ deleted: number; errors: number }> {
  const client = await db.pool.connect();
  let deleted = 0;
  let errors = 0;

  try {
    const { rows: expired } = await client.query<{
      id: string;
      auth0_user_id: string | null;
      auth0_user_created: boolean;
      user_id: string;
    }>(
      `SELECT id, auth0_user_id, auth0_user_created, user_id
       FROM accounter_schema.invitations
       WHERE accepted_at IS NULL
         AND expires_at < NOW()`,
    );

    for (const invitation of expired) {
      try {
        if (invitation.auth0_user_created && invitation.auth0_user_id) {
          await auth0.deleteUser(invitation.auth0_user_id);
        }

        await client.query('BEGIN');
        try {
          await client.query(
            `DELETE FROM accounter_schema.business_users
             WHERE user_id = $1 AND auth0_user_id IS NULL`,
            [invitation.user_id],
          );

          await client.query('DELETE FROM accounter_schema.invitations WHERE id = $1', [
            invitation.id,
          ]);

          await client.query(
            `INSERT INTO accounter_schema.audit_logs (action, entity, entity_id, details)
             VALUES ('INVITATION_EXPIRED_CLEANUP', 'Invitation', $1, $2)`,
            [invitation.id, JSON.stringify({ auth0_user_id: invitation.auth0_user_id })],
          );

          await client.query('COMMIT');
          deleted++;
        } catch (dbError) {
          await client.query('ROLLBACK');
          throw dbError;
        }
      } catch (err) {
        logger.error('Failed to cleanup invitation', { invitationId: invitation.id, err });
        errors++;
      }
    }
  } finally {
    client.release();
  }

  return { deleted, errors };
}
