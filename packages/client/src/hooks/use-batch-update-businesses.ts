import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  BatchUpdateBusinessesDocument,
  type BatchUpdateBusinessesMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  const [{ fetching }, mutate] = useMutation(BatchUpdateBusinessesDocument);
  const batchUpdateBusinesses = useCallback(
    async (variables: BatchUpdateBusinessesMutationVariables) => {
      const message = `Error updating ${variables.businessIds.length} businesses`;
      toast.loading('Updating businesses', { id: NOTIFICATION_ID });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, NOTIFICATION_ID);
        if (data) {
          toast.success('Success', {
            id: NOTIFICATION_ID,
            description: 'Businesses updated',
          });
          return true;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: NOTIFICATION_ID,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return false;
    },
    [mutate],
  );

  return { fetching, batchUpdateBusinesses };
};
