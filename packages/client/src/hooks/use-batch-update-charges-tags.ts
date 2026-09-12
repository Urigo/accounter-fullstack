import {
  BatchUpdateChargesTagsDocument,
  type BatchUpdateChargesTagsMutation,
  type BatchUpdateChargesTagsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<Charges | void>;
};

const NOTIFICATION_ID = 'batchUpdateChargesTags';

export const useBatchUpdateChargesTags = (): UseBatchUpdateChargesTags => {
  const { fetching, execute } = useApiMutation({
    document: BatchUpdateChargesTagsDocument,
    // Short, stable toast id — a batch action, so don't build it from every selected UUID.
    notificationId: `${NOTIFICATION_ID}-batch`,
    loadingMessage: 'Updating tags',
    errorMessage: 'Error updating charges tags',
    commonErrorPath: 'batchUpdateChargesTags',
    select: data => data.batchUpdateChargesTags.charges,
    successToast: (_result, variables) => {
      const count = variables.chargeIds.length;
      return { description: `Tags updated for ${count} charge${count > 1 ? 's' : ''}` };
    },
  });

  return {
    fetching,
    batchUpdateChargesTags: execute,
  };
};
