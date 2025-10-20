import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateContractDocument,
  type UpdateContractMutation,
  type UpdateContractMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateContract($contractId: UUID!, $input: UpdateContractInput!) {
    updateContract(contractId: $contractId, input: $input) {
      id
    }
  }
`;

type Contract = UpdateContractMutation['updateContract'];

type UseUpdateContract = {
  updating: boolean;
  updateContract: (variables: UpdateContractMutationVariables) => Promise<Contract | void>;
};

const NOTIFICATION_ID = 'updateContract';

export const useUpdateContract = (): UseUpdateContract => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateContractDocument);
  const updateContract = useCallback(
    async (variables: UpdateContractMutationVariables) => {
      const message = `Error updating contract ID [${variables.contractId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.contractId}`;
      toast.loading('Updating contract', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateContract');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Contract updated',
          });
          return data.updateContract;
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
    updating: fetching,
    updateContract,
  };
};
