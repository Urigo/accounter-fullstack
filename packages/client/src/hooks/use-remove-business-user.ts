import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, type CombinedError } from 'urql';
import { RemoveBusinessUserDocument, type RemoveBusinessUserMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  const [{ fetching, error }, mutate] = useMutation(RemoveBusinessUserDocument);
  const removeBusinessUser = useCallback(
    async (userId: string) => {
      const message = 'Error removing user';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Removing user', {
        id: notificationId,
      });
      try {
        const result = await mutate({ userId });
        const data = handleCommonErrors(result, message, notificationId);
        if (data) {
          if (data.removeBusinessUser) {
            toast.success('Success', {
              id: notificationId,
              description: 'User removed successfully',
            });
            return true;
          }
          // No GraphQL error, but nothing was removed (already removed or not found).
          toast.error('Error', {
            id: notificationId,
            description: 'Failed to remove user. They may have already been removed.',
          });
          return false;
        }
      } catch (e) {
        console.error(message, e);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 10_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    error,
    removeBusinessUser,
  };
};
