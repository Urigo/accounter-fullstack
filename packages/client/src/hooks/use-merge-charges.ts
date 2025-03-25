import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  MergeChargesDocument,
  MergeChargesMutation,
  MergeChargesMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(MergeChargesDocument);
  const mergeCharges = useCallback(
    async (variables: MergeChargesMutationVariables) => {
      const message = `Error merging into charge ID [${variables.baseChargeID}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.baseChargeID}`;
      toast.loading('Merging Charges', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'mergeCharges');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Charges were merged',
          });
          return data.mergeCharges.charge;
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
    mergeCharges,
  };
};
