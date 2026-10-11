import { sql } from '@pgtyped/runtime';
import type { IGetAuth0UserReferencesQuery } from '../types.js';

type Queryable = Parameters<typeof getAuth0UserReferences.run>[1];

// Auth0 users are reused across invitations (`createBlockedUser` returns an existing user
// for the email), so an Auth0 user may be cleaned up only once nothing else points at it.
const getAuth0UserReferences = sql<IGetAuth0UserReferencesQuery>`
  SELECT (
    EXISTS (
      SELECT 1 FROM accounter_schema.invitations
      WHERE auth0_user_id = $auth0UserId
        AND ($excludeInvitationId::uuid IS NULL OR id <> $excludeInvitationId::uuid)
    )
    OR EXISTS (
      SELECT 1 FROM accounter_schema.business_users
      WHERE auth0_user_id = $auth0UserId
    )
  ) AS "referenced!";
`;

/**
 * Whether an Auth0 user is referenced by any invitation (other than
 * `excludeInvitationId`) or by any business membership.
 */
export async function isAuth0UserReferenced(
  client: Queryable,
  auth0UserId: string,
  excludeInvitationId: string | null = null,
): Promise<boolean> {
  const [row] = await getAuth0UserReferences.run({ auth0UserId, excludeInvitationId }, client);
  return row?.referenced ?? true;
}
