import { useCallback } from 'react';
import { DeleteContractDocument, type DeleteContractMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: DeleteContractDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.contractId}`,
    loadingMessage: 'Deleting contract',
    errorMessage: variables => `Error deleting contract ID [${variables.contractId}]`,
    select: data => {
      if (data.deleteContract === false) {
        throw new Error('Unsuccessful deletion');
      }
      return data.deleteContract;
    },
    successToast: { description: 'Contract was deleted' },
  });

  const deleteContract = useCallback(
    async (variables: DeleteContractMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return {
    fetching,
    deleteContract,
  };
};
