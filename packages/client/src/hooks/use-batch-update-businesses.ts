import { useCallback } from 'react';
import {
  BatchUpdateBusinessesDocument,
  type BatchUpdateBusinessesMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation BatchUpdateBusinesses($businessIds: [UUID!]!, $fields: BatchUpdateBusinessInput!) {
    batchUpdateBusinesses(businessIds: $businessIds, fields: $fields) {
      id
    }
  }
`;

type UseBatchUpdateBusinesses = {
  fetching: boolean;
  batchUpdateBusinesses: (variables: BatchUpdateBusinessesMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'batchUpdateBusinesses';

export const useBatchUpdateBusinesses = (): UseBatchUpdateBusinesses => {
  const { fetching, execute } = useApiMutation({
    document: BatchUpdateBusinessesDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating businesses',
    errorMessage: variables => `Error updating ${variables.businessIds.length} businesses`,
    select: () => true,
    successToast: { description: 'Businesses updated' },
  });

  const batchUpdateBusinesses = useCallback(
    async (variables: BatchUpdateBusinessesMutationVariables) =>
      (await execute(variables)) ?? false,
    [execute],
  );

  return { fetching, batchUpdateBusinesses };
};
