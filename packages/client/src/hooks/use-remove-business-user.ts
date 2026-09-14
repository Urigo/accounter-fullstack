import { useCallback } from 'react';
import type { CombinedError } from 'urql';
import { RemoveBusinessUserDocument, type RemoveBusinessUserMutation } from '../gql/graphql.js';
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
  removeBusinessUser: (
    userId: string,
  ) => Promise<RemoveBusinessUserMutation['removeBusinessUser'] | void>;
};

const NOTIFICATION_ID = 'removeBusinessUser';

export const useRemoveBusinessUser = (): UseRemoveBusinessUser => {
  const { fetching, error, execute } = useApiMutation({
    document: RemoveBusinessUserDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Removing user',
    errorMessage: 'Error removing user',
    select: data => data.removeBusinessUser,
    // A `false` is not a failure to report through the error path: the mutation resolved, and
    // callers refetch on it so the stale row is dropped. It only needs its own notification.
    successToast: removed =>
      removed
        ? { description: 'User removed successfully' }
        : {
            variant: 'error',
            title: 'Error',
            description: 'Failed to remove user. They may have already been removed.',
          },
    errorToast: { duration: 10_000 },
  });

  const removeBusinessUser = useCallback((userId: string) => execute({ userId }), [execute]);

  return {
    fetching,
    error,
    removeBusinessUser,
  };
};
