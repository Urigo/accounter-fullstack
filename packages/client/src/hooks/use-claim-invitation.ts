import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, type CombinedError } from 'urql';
import { ClaimInvitationDocument, type ClaimInvitationMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation ClaimInvitation($invitationId: UUID!) {
    claimInvitation(invitationId: $invitationId) {
      success
      businessId
      roleId
    }
  }
`;

type UseClaimInvitation = {
  fetching: boolean;
  error: CombinedError | undefined;
  claimInvitation: (
    invitationId: string,
  ) => Promise<ClaimInvitationMutation['claimInvitation'] | void>;
};

const NOTIFICATION_ID = 'claimInvitation';

export const useClaimInvitation = (): UseClaimInvitation => {
  const [{ fetching, error }, mutate] = useMutation(ClaimInvitationDocument);
  const claimInvitation = useCallback(
    async (invitationId: string) => {
      const message = 'Error joining business';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Joining business', {
        id: notificationId,
      });
      try {
        const result = await mutate({ invitationId });
        const data = handleCommonErrors(result, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Invitation accepted successfully',
          });
          return data.claimInvitation;
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

  return { fetching, error, claimInvitation };
};
