import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { DeleteContractDocument, type DeleteContractMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteContract($contractId: UUID!) {
    deleteContract(id: $contractId)
  }
`;

type UseDeleteContract = {
  fetching: boolean;
  deleteContract: (variables: DeleteContractMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'deleteContract';

export const useDeleteContract = (): UseDeleteContract => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const [{ fetching }, mutate] = useMutation(DeleteContractDocument);
  const deleteContract = useCallback(
    async (variables: DeleteContractMutationVariables) => {
      const message = `Error deleting contract ID [${variables.contractId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.contractId}`;
      toast.loading('Deleting contract', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          if (data.deleteContract === false) {
            throw new Error('Unsuccessful deletion');
          }
          toast.success('Success', {
            id: notificationId,
            description: 'Contract was deleted',
          });
          return data.deleteContract;
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
    deleteContract,
  };
};
