import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, type CombinedError } from 'urql';
import { RevokeInvitationDocument, type RevokeInvitationMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation RevokeInvitation($id: ID!) {
    revokeInvitation(id: $id)
  }
`;

type UseRevokeInvitation = {
  fetching: boolean;
  error: CombinedError | undefined;
  revokeInvitation: (id: string) => Promise<RevokeInvitationMutation['revokeInvitation'] | void>;
};

const NOTIFICATION_ID = 'revokeInvitation';

export const useRevokeInvitation = (): UseRevokeInvitation => {
  const [{ fetching, error }, mutate] = useMutation(RevokeInvitationDocument);
  const revokeInvitation = useCallback(
    async (id: string) => {
      const message = 'Error revoking invitation';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Revoking invitation', {
        id: notificationId,
      });
      try {
        const result = await mutate({ id });
        const data = handleCommonErrors(result, message, notificationId);
        if (data) {
          if (data.revokeInvitation) {
            toast.success('Success', {
              id: notificationId,
              description: 'Invitation revoked successfully',
            });
            return true;
          }
          // No GraphQL error, but nothing was revoked (already revoked or not found).
          toast.error('Error', {
            id: notificationId,
            description: 'Failed to revoke invitation. It may have already been revoked.',
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
    revokeInvitation,
  };
};
