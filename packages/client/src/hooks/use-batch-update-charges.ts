import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  BatchUpdateChargesDocument,
  type BatchUpdateChargesMutation,
  type BatchUpdateChargesMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';
import { useRefreshCharges } from '../providers/charge-refresh.js';

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

  const [{ fetching }, mutate] = useMutation(BatchUpdateChargesDocument);
  // A batch update, by definition, changes charges the caller isn't rendering an action for — the
  // similar-charges dialog applies one charge's tags/description to a set of others. Any of those
  // that are rows in a charges table would otherwise keep their pre-mutation values until a reload,
  // so refresh them here rather than asking every caller to remember. A no-op outside a charges
  // table, and for ids that aren't currently rendered.
  const refreshCharges = useRefreshCharges();
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
          // The server's own list, not the requested ids — only these actually changed.
          refreshCharges(data.batchUpdateCharges.charges.map(charge => charge.id));
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
    [mutate, refreshCharges],
  );

  return {
    fetching,
    batchUpdateCharges,
  };
};
