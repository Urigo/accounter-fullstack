import {
  CreateFinancialAccountDocument,
  type CreateFinancialAccountMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreateFinancialAccount($input: CreateFinancialAccountInput!) {
    createFinancialAccount(input: $input) {
      id
    }
  }
`;

type UseCreateFinancialAccount = {
  creating: boolean;
  createFinancialAccount: (variables: CreateFinancialAccountMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'createFinancialAccount';

export const useCreateFinancialAccount = (): UseCreateFinancialAccount => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: CreateFinancialAccountDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.input.name}`,
    loadingMessage: 'Creating account',
    errorMessage: variables => `Error creating new account "${variables.input.name}"`,
    select: () => void 0,
    successToast: (_result, variables) => ({
      description: `Financial Account ${variables.input.name} was successfully created`,
    }),
  });

  return {
    creating: fetching,
    createFinancialAccount: execute,
  };
};
