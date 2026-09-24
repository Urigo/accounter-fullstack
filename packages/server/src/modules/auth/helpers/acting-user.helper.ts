import type { Injector } from 'graphql-modules';
import { UUID_REGEX } from '../../../shared/constants.js';
import { AuthContextProvider } from '../providers/auth-context.provider.js';

/**
 * The acting user's id, for recording who made a change (a `created_by` column, an approval
 * stamp). Such fields hold user ids, so a caller without a user row behind it — an API key's
 * synthetic `api-key:<id>`, for instance — is returned as null rather than failing the write.
 */
export async function getActingUserId(injector: Injector): Promise<string | null> {
  const authContext = await injector.get(AuthContextProvider).getAuthContext();
  const userId = authContext?.user?.userId;
  return userId && UUID_REGEX.test(userId) ? userId : null;
}
