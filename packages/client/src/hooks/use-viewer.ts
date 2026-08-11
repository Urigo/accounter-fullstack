import { useQuery, type CombinedError } from 'urql';
import { ViewerDocument, type ViewerQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Viewer {
    viewer {
      email
      emailVerified
      status
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
