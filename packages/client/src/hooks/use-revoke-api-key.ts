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

const MESSAGE = 'Error revoking API key';

export const useRevokeApiKey = (): UseRevokeApiKey => {
  const { fetching, error, execute } = useApiMutation({
    document: RevokeApiKeyDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Revoking API key',
    errorMessage: MESSAGE,
    select: data => {
      if (!data.revokeApiKey) {
        // No GraphQL error, but the key was not revoked (already revoked or not found).
        throw new Error('Failed to revoke API key. It may have already been revoked.');
      }
      return true as const;
    },
    successToast: { description: 'API key revoked successfully' },
    errorDescription: e => (e instanceof Error ? e.message : MESSAGE),
    errorToast: { duration: 10_000 },
  });

  const revokeApiKey = useCallback((id: string) => execute({ id }), [execute]);

  return {
    fetching,
    error,
    revokeApiKey,
  };
};
