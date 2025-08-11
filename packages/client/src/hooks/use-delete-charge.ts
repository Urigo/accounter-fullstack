import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { DeleteChargeDocument, type DeleteChargeMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteCharge($chargeId: UUID!) {
    deleteCharge(chargeId: $chargeId)
  }
`;

type UseDeleteCharge = {
  fetching: boolean;
  deleteCharge: (variables: DeleteChargeMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'deleteCharge';

export const useDeleteCharge = (): UseDeleteCharge => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const [{ fetching }, mutate] = useMutation(DeleteChargeDocument);
  const deleteCharge = useCallback(
    async (variables: DeleteChargeMutationVariables) => {
      const message = `Error deleting charge ID [${variables.chargeId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Deleting charge', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          if (data.deleteCharge === false) {
            throw new Error('Unsuccessful deletion');
          }
          toast.success('Success', {
            id: notificationId,
            description: 'Charge was deleted',
          });
          return data.deleteCharge;
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
      return false;
    },
    [mutate],
  );

  return {
    fetching,
    deleteCharge,
  };
};
