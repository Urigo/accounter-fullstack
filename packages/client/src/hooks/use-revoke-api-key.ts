import { useCallback } from 'react';
import type { CombinedError } from 'urql';
import { RevokeApiKeyDocument, type RevokeApiKeyMutation } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation RevokeApiKey($id: ID!) {
    revokeApiKey(id: $id)
  }
`;

type UseRevokeApiKey = {
  fetching: boolean;
  error: CombinedError | undefined;
  revokeApiKey: (id: string) => Promise<RevokeApiKeyMutation['revokeApiKey'] | void>;
};

const NOTIFICATION_ID = 'revokeApiKey';

export const useRevokeApiKey = (): UseRevokeApiKey => {
  const { fetching, error, execute } = useApiMutation({
    document: RevokeApiKeyDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Revoking API key',
    errorMessage: 'Error revoking API key',
    select: data => data.revokeApiKey,
    // A `false` is not a failure to report through the error path: the mutation resolved, and
    // callers refetch on it so the stale row is dropped. It only needs its own notification.
    successToast: revoked =>
      revoked
        ? { description: 'API key revoked successfully' }
        : {
            variant: 'error',
            title: 'Error',
            description: 'Failed to revoke API key. It may have already been revoked.',
          },
    errorToast: { duration: 10_000 },
  });

  const revokeApiKey = useCallback((id: string) => execute({ id }), [execute]);

  return {
    fetching,
    error,
    revokeApiKey,
  };
};
