import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { MergeBusinessesDocument, type MergeBusinessesMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation MergeBusinesses($targetBusinessId: UUID!, $businessIdsToMerge: [UUID!]!) {
    mergeBusinesses(targetBusinessId: $targetBusinessId, businessIdsToMerge: $businessIdsToMerge) {
      __typename
      id
    }
  }
`;

type UseMergeBusinesses = {
  fetching: boolean;
  mergeBusinesses: (variables: MergeBusinessesMutationVariables) => Promise<string | void>;
};

const NOTIFICATION_ID = 'mergeBusinesses';

export const useMergeBusinesses = (): UseMergeBusinesses => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(MergeBusinessesDocument);
  const mergeBusinesses = useCallback(
    async (variables: MergeBusinessesMutationVariables) => {
      const message = `Error merging into business ID [${variables.targetBusinessId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.targetBusinessId}`;
      toast.loading('Merging Businesses', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Businesses merged',
          });
          return data.mergeBusinesses.id;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    mergeBusinesses,
  };
};
