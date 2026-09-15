import {
  MergeChargesDocument,
  type MergeChargesMutation,
  type MergeChargesMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation MergeCharges(
    $baseChargeID: UUID!
    $chargeIdsToMerge: [UUID!]!
    $fields: UpdateChargeInput
  ) {
    mergeCharges(
      baseChargeID: $baseChargeID
      chargeIdsToMerge: $chargeIdsToMerge
      fields: $fields
    ) {
      __typename
      ... on MergeChargeSuccessfulResult {
        charge {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Charge = Extract<
  MergeChargesMutation['mergeCharges'],
  { __typename: 'MergeChargeSuccessfulResult' }
>['charge'];

type UseMergeCharges = {
  fetching: boolean;
  mergeCharges: (variables: MergeChargesMutationVariables) => Promise<Charge | void>;
};

const NOTIFICATION_ID = 'mergeCharges';

export const useMergeCharges = (): UseMergeCharges => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: MergeChargesDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.baseChargeID}`,
    loadingMessage: 'Merging Charges',
    errorMessage: variables => `Error merging into charge ID [${variables.baseChargeID}]`,
    commonErrorPath: 'mergeCharges',
    select: data => data.mergeCharges.charge,
    successToast: { description: 'Charges were merged' },
  });

  return {
    fetching,
    mergeCharges: execute,
  };
};
