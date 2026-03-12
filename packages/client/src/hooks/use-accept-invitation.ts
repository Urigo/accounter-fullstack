import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, type CombinedError } from 'urql';
import { AcceptInvitationDocument, type AcceptInvitationMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AcceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      success
      businessId
      roleId
    }
  }
`;

type UseAcceptInvitation = {
  fetching: boolean;
  error: CombinedError | undefined;
  acceptInvitation: (token: string) => Promise<AcceptInvitationMutation['acceptInvitation'] | void>;
};

const NOTIFICATION_ID = 'acceptInvitation';

export const useAcceptInvitation = (): UseAcceptInvitation => {
  const [{ fetching, error }, mutate] = useMutation(AcceptInvitationDocument);
  const acceptInvitation = useCallback(
    async (token: string) => {
      const message = 'Error accepting invitation';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Accepting invitation', {
        id: notificationId,
      });
      try {
        const result = await mutate({ token });
        const data = handleCommonErrors(result, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Invitation accepted successfully',
          });
          return data.acceptInvitation;
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
    acceptInvitation,
  };
};
