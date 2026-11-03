import {
  UpdateSecuritiesContextDocument,
  type UpdateSecuritiesContextMutation,
  type UpdateSecuritiesContextMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateSecuritiesContext($input: SecuritiesContextInput!) {
    updateSecuritiesContext(input: $input) {
      id
      foreignSecuritiesBusiness {
        id
        name
      }
      sortCode {
        id
        key
        name
      }
      taxCategories {
        id
        key
        taxCategory {
          id
          name
        }
      }
    }
  }
`;

type SecuritiesContext = UpdateSecuritiesContextMutation['updateSecuritiesContext'];

type UseUpdateSecuritiesContext = {
  fetching: boolean;
  updateSecuritiesContext: (
    variables: UpdateSecuritiesContextMutationVariables,
  ) => Promise<SecuritiesContext | void>;
};

const NOTIFICATION_ID = 'updateSecuritiesContext';

export const useUpdateSecuritiesContext = (): UseUpdateSecuritiesContext => {
  const { fetching, execute } = useApiMutation({
    document: UpdateSecuritiesContextDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Saving securities settings',
    errorMessage: 'Error saving securities settings',
    // the server explains a rejected setting (a foreign tax category, an unknown sort code)
    errorDescription: e => (e instanceof Error ? e.message : 'Error saving securities settings'),
    select: data => data.updateSecuritiesContext,
    successToast: { description: 'Securities settings saved' },
  });

  return {
    fetching,
    updateSecuritiesContext: execute,
  };
};
