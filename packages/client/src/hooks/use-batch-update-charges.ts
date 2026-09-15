import {
  BatchUpdateChargesDocument,
  type BatchUpdateChargesMutation,
  type BatchUpdateChargesMutationVariables,
} from '../gql/graphql.js';
import { useRefreshCharges } from '../providers/charge-refresh.js';
import { useApiMutation } from './use-api-mutation.js';

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
  batchUpdateCharges: (variables: BatchUpdateChargesMutationVariables) => Promise<Charges | void>;
};

const NOTIFICATION_ID = 'batchUpdateCharges';

const toChargeIds = (chargeIds: BatchUpdateChargesMutationVariables['chargeIds']): string[] =>
  Array.isArray(chargeIds) ? chargeIds : [chargeIds];

export const useBatchUpdateCharges = (): UseBatchUpdateCharges => {
  // TODO: add authentication

  // A batch update, by definition, changes charges the caller isn't rendering an action for — the
  // similar-charges dialog applies one charge's tags/description to a set of others. Any of those
  // that are rows in a charges table would otherwise keep their pre-mutation values until a reload,
  // so refresh them here rather than asking every caller to remember. A no-op outside a charges
  // table, and for ids that aren't currently rendered.
  const refreshCharges = useRefreshCharges();

  const { fetching, execute } = useApiMutation({
    document: BatchUpdateChargesDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${toChargeIds(variables.chargeIds)[0]}`,
    loadingMessage: 'Updating charge',
    errorMessage: variables =>
      `Error updating charge IDs [${toChargeIds(variables.chargeIds).join(', ')}]`,
    commonErrorPath: 'batchUpdateCharges',
    select: data => data.batchUpdateCharges.charges,
    successToast: (_result, variables) => {
      const count = toChargeIds(variables.chargeIds).length;
      return { description: `${count} charge${count > 1 ? 's' : ''} updated` };
    },
    // The server's own list, not the requested ids — only these actually changed.
    onSuccess: charges => refreshCharges(charges.map(charge => charge.id)),
  });

  return {
    fetching,
    batchUpdateCharges: execute,
  };
};
