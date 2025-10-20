import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { CreateContractDocument, type CreateContractMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreateContract($input: CreateContractInput!) {
    createContract(input: $input) {
      id
    }
  }
`;

type UseCreateContract = {
  creating: boolean;
  createContract: (variables: CreateContractMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'createContract';

export const useCreateContract = (): UseCreateContract => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(CreateContractDocument);
  const createContract = useCallback(
    async (variables: CreateContractMutationVariables) => {
      const message = `Error creating new contract for client[${variables.input.clientId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.input.clientId}`;
      toast.loading('Creating contract', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Contract for client ${variables.input.clientId} was successfully created`,
          });
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
    creating: fetching,
    createContract,
  };
};
