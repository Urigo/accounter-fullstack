import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AccountantStatus,
  UpdateBusinessTripAccountantApprovalDocument,
  UpdateBusinessTripAccountantApprovalMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripAccountantApproval(
    $businessTripId: UUID!
    $status: AccountantStatus!
  ) {
    updateBusinessTripAccountantApproval(businessTripId: $businessTripId, approvalStatus: $status)
  }
`;

type UseUpdateBusinessTripAccountantApproval = {
  fetching: boolean;
  updateBusinessTripAccountantApproval: (
    variables: UpdateBusinessTripAccountantApprovalMutationVariables,
  ) => Promise<AccountantStatus | void>;
};

const NOTIFICATION_ID = 'updateBusinessTripAccountantApproval';

export const useUpdateBusinessTripAccountantApproval =
  (): UseUpdateBusinessTripAccountantApproval => {
    // TODO: add authentication
    // TODO: add local data update method after change

    const [{ fetching }, mutate] = useMutation(UpdateBusinessTripAccountantApprovalDocument);
    const updateBusinessTripAccountantApproval = useCallback(
      async (variables: UpdateBusinessTripAccountantApprovalMutationVariables) => {
        const message = `Error toggling accountant approval for trip [${variables.businessTripId}]`;
        const notificationId = `${NOTIFICATION_ID}-${variables.businessTripId}`;
        toast.loading('Updating accountant approval status', {
          id: notificationId,
        });
        try {
          const res = await mutate(variables);
          const data = handleCommonErrors(res, message, notificationId);
          if (data) {
            toast.success('Success', {
              id: notificationId,
              description: 'Accountant approval status updated',
            });
            return data.updateBusinessTripAccountantApproval;
          }
        } catch (e) {
          console.error(`${message}: ${e}`);
          toast.error('Error', {
            id: notificationId,
            description: message,
            duration: 100_000,
            closeButton: true,
          });
        }
        return void 0;
      },
      [mutate],
    );

    return {
      fetching,
      updateBusinessTripAccountantApproval,
    };
  };
