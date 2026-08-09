import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  BatchUpdateBusinessesTagsDocument,
  type BatchUpdateBusinessesTagsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation BatchUpdateBusinessesTags(
    $businessIds: [UUID!]!
    $addTagIds: [UUID!]
    $removeTagIds: [UUID!]
  ) {
    batchUpdateBusinessesTags(
      businessIds: $businessIds
      addTagIds: $addTagIds
      removeTagIds: $removeTagIds
    ) {
      id
    }
  }
`;

type UseBatchUpdateBusinessesTags = {
  fetching: boolean;
  batchUpdateBusinessesTags: (
    variables: BatchUpdateBusinessesTagsMutationVariables,
  ) => Promise<boolean>;
};

// Short, stable toast id — a batch action, so don't build it from every selected UUID.
const NOTIFICATION_ID = 'batchUpdateBusinessesTags';

export const useBatchUpdateBusinessesTags = (): UseBatchUpdateBusinessesTags => {
  const [{ fetching }, mutate] = useMutation(BatchUpdateBusinessesTagsDocument);
  const batchUpdateBusinessesTags = useCallback(
    async (variables: BatchUpdateBusinessesTagsMutationVariables) => {
      const count = variables.businessIds.length;
      const message = `Error updating tags for ${count} business${count === 1 ? '' : 'es'}`;
      toast.loading('Updating tags', { id: NOTIFICATION_ID });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, NOTIFICATION_ID);
        if (data) {
          toast.success('Success', {
            id: NOTIFICATION_ID,
            description: `Tags updated for ${count} business${count === 1 ? '' : 'es'}`,
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

  return { fetching, batchUpdateBusinessesTags };
};
