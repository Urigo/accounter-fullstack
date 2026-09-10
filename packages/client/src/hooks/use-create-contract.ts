import { CreateContractDocument, type CreateContractMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: CreateContractDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.input.clientId}`,
    loadingMessage: 'Creating contract',
    errorMessage: variables =>
      `Error creating new contract for client[${variables.input.clientId}]`,
    select: () => void 0,
    successToast: (_result, variables) => ({
      description: `Contract for client ${variables.input.clientId} was successfully created`,
    }),
  });

  return {
    creating: fetching,
    createContract: execute,
  };
};
