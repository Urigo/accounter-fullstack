import { useContext } from 'react';
import { useQuery, type CombinedError } from 'urql';
import { ViewerDocument, type ViewerQuery } from '../gql/graphql.js';
import { UserContext } from '../providers/user-provider.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Viewer {
    viewer {
      email
      emailVerified
      status
      isSuperAdmin
      hasPendingInvitation
    }
  }
`;

type UseViewer = {
  fetching: boolean;
  error: CombinedError | undefined;
  viewer: ViewerQuery['viewer'];
};

/**
 * The caller's identity and provisioning state.
 *
 * `viewer` is unauthenticated-safe on the server, so this is the one query that
 * still answers for a user who is logged in to Auth0 but linked to no business.
 */
export const useViewer = (options?: { pause?: boolean }): UseViewer => {
  const [{ data, fetching, error }] = useQuery({
    query: ViewerDocument,
    pause: options?.pause ?? false,
  });

  return { fetching, error, viewer: data?.viewer ?? null };
};

/**
 * The signed-in caller's `viewer`, as the app's boot request read it (see `UserProvider`), without
 * a request of its own. Inside the app shell, prefer this to {@link useViewer}: the boot request
 * already carries it.
 *
 * The boot request is read when the app loads, and again for a new business scope or identity. In
 * between this can be stale. A status that is not `ACTIVE` can change without a reload (an
 * invitation accepted): read it again with {@link useViewer} before acting on it, as
 * `OnboardingGuard` does.
 */
export const useSessionViewer = (): UseViewer => {
  const { session } = useContext(UserContext);
  return {
    fetching: !session?.loaded,
    error: session?.error,
    viewer: session?.viewer ?? null,
  };
};
