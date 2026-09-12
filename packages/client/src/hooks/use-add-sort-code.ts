import { AddSortCodeDocument, type AddSortCodeMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddSortCode($key: Int!, $name: String!, $defaultIrsCode: Int) {
    addSortCode(key: $key, name: $name, defaultIrsCode: $defaultIrsCode)
  }
`;

type UseAddSortCode = {
  fetching: boolean;
  addSortCode: (variables: AddSortCodeMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'addSortCode';

export const useAddSortCode = (): UseAddSortCode => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: AddSortCodeDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.name}`,
    loadingMessage: 'Adding sort code',
    errorMessage: variables => `Error adding new sort code [${variables.name}]`,
    select: () => void 0,
    successToast: (_result, variables) => ({
      description: `"${variables.name}" sort code was successfully added`,
    }),
  });

  return {
    fetching,
    addSortCode: execute,
  };
};
