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
    loadingMessage: 'Saving securities tax categories',
    errorMessage: 'Error saving securities tax categories',
    select: data => data.updateSecuritiesContext,
    successToast: { description: 'Securities tax categories saved' },
  });

  return {
    fetching,
    updateSecuritiesContext: execute,
  };
};
