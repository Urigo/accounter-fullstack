import { useCallback } from 'react';
import { UpdateSortCodeDocument, type UpdateSortCodeMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateSortCode($key: Int!, $fields: UpdateSortCodeFieldsInput!) {
    updateSortCode(key: $key, fields: $fields)
  }
`;

type UseUpdateSortCode = {
  fetching: boolean;
  updateSortCode: (variables: UpdateSortCodeMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'updateSortCode';

export const useUpdateSortCode = (): UseUpdateSortCode => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateSortCodeDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.key}`,
    loadingMessage: 'Updating Sort Code...',
    errorMessage: variables => `Error updating sort code ID [${variables.key}]`,
    commonErrorPath: 'updateSortCode',
    select: data => data.updateSortCode,
    successToast: { description: 'SortCode updated' },
  });

  const updateSortCode = useCallback(
    async (variables: UpdateSortCodeMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return {
    fetching,
    updateSortCode,
  };
};
