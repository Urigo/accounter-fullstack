import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  BatchUpdateChargesTagsDocument,
  type BatchUpdateChargesTagsMutation,
  type BatchUpdateChargesTagsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation BatchUpdateChargesTags(
    $chargeIds: [UUID!]!
    $addTagIds: [UUID!]
    $removeTagIds: [UUID!]
  ) {
    batchUpdateChargesTags(
      chargeIds: $chargeIds
      addTagIds: $addTagIds
      removeTagIds: $removeTagIds
    ) {
      __typename
      ... on BatchUpdateChargesTagsSuccessfulResult {
        charges {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Charges = Extract<
  BatchUpdateChargesTagsMutation['batchUpdateChargesTags'],
  { __typename: 'BatchUpdateChargesTagsSuccessfulResult' }
>['charges'];

type UseBatchUpdateChargesTags = {
  fetching: boolean;
  batchUpdateChargesTags: (
    variables: BatchUpdateChargesTagsMutationVariables,
  ) => Promise<Charges | undefined>;
};

const NOTIFICATION_ID = 'batchUpdateChargesTags';

export const useBatchUpdateChargesTags = (): UseBatchUpdateChargesTags => {
  const [{ fetching }, mutate] = useMutation(BatchUpdateChargesTagsDocument);
  const batchUpdateChargesTags = useCallback(
    async (variables: BatchUpdateChargesTagsMutationVariables) => {
      const count = variables.chargeIds.length;
      const message = 'Error updating charges tags';
      // Short, stable toast id — a batch action, so don't build it from every selected UUID.
      const notificationId = `${NOTIFICATION_ID}-batch`;
      toast.loading('Updating tags', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'batchUpdateChargesTags');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Tags updated for ${count} charge${count > 1 ? 's' : ''}`,
          });
          return data.batchUpdateChargesTags.charges;
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
    batchUpdateChargesTags,
  };
};
