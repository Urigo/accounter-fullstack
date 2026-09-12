import {
  UpdateContractDocument,
  type UpdateContractMutation,
  type UpdateContractMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UpdateContractDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.contractId}`,
    loadingMessage: 'Updating contract',
    errorMessage: variables => `Error updating contract ID [${variables.contractId}]`,
    commonErrorPath: 'updateContract',
    select: data => data.updateContract,
    successToast: { description: 'Contract updated' },
  });

  return {
    updating: fetching,
    updateContract: execute,
  };
};
