import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  BatchUpdateChargesDocument,
  BatchUpdateChargesMutation,
  BatchUpdateChargesMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation BatchUpdateCharges($chargeIds: [UUID!]!, $fields: UpdateChargeInput!) {
    batchUpdateCharges(chargeIds: $chargeIds, fields: $fields) {
      __typename
      ... on BatchUpdateChargesSuccessfulResult {
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
  BatchUpdateChargesMutation['batchUpdateCharges'],
  { __typename: 'BatchUpdateChargesSuccessfulResult' }
>['charges'];

type UseBatchUpdateCharges = {
  fetching: boolean;
  batchUpdateCharges: (
    variables: BatchUpdateChargesMutationVariables,
  ) => Promise<Charges | undefined>;
};

const NOTIFICATION_ID = 'batchUpdateCharges';

export const useBatchUpdateCharges = (): UseBatchUpdateCharges => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(BatchUpdateChargesDocument);
  const batchUpdateCharges = useCallback(
    async (variables: BatchUpdateChargesMutationVariables) => {
      const chargeIds = Array.isArray(variables.chargeIds)
        ? variables.chargeIds
        : [variables.chargeIds];
      const message = `Error updating charge IDs [${chargeIds.join(', ')}]`;
      const notificationId = `${NOTIFICATION_ID}-${chargeIds[0]}`;
      toast.loading('Updating charge', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'batchUpdateCharges');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `${chargeIds.length} charge${chargeIds.length > 1 ? 's' : ''} updated`,
          });
          return data.batchUpdateCharges.charges;
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
    batchUpdateCharges,
  };
};
