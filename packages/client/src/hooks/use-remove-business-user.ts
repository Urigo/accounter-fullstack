import { useCallback } from 'react';
import type { CombinedError } from 'urql';
import { RemoveBusinessUserDocument } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation RemoveBusinessUser($userId: ID!) {
    removeBusinessUser(userId: $userId)
  }
`;

type UseRemoveBusinessUser = {
  fetching: boolean;
  error: CombinedError | undefined;
  removeBusinessUser: (userId: string) => Promise<true | void>;
};

const NOTIFICATION_ID = 'removeBusinessUser';

const MESSAGE = 'Error removing user';

export const useRemoveBusinessUser = (): UseRemoveBusinessUser => {
  const { fetching, error, execute } = useApiMutation({
    document: RemoveBusinessUserDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Removing user',
    errorMessage: MESSAGE,
    select: data => {
      if (!data.removeBusinessUser) {
        // No GraphQL error, but nothing was removed (already removed or not found).
        throw new Error('Failed to remove user. They may have already been removed.');
      }
      return true as const;
    },
    successToast: { description: 'User removed successfully' },
    errorDescription: e => (e instanceof Error ? e.message : MESSAGE),
    errorToast: { duration: 10_000 },
  });

  const removeBusinessUser = useCallback((userId: string) => execute({ userId }), [execute]);

  return {
    fetching,
    error,
    removeBusinessUser,
  };
};
