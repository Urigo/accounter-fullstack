import { useCallback } from 'react';
import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  MergeChargesDocument,
  MergeChargesMutation,
  MergeChargesMutationVariables,
} from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

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
  mergeCharges: (variables: MergeChargesMutationVariables) => Promise<Charge>;
};

const NOTIFICATION_ID = 'mergeCharges';

export const useMergeCharges = (): UseMergeCharges => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(MergeChargesDocument);
  const { handleKnownErrors } = useHandleKnownErrors();

  const mergeCharges = useCallback(
    async (variables: MergeChargesMutationVariables): Promise<Charge> => {
      const notificationId = `${NOTIFICATION_ID}-${typeof variables.chargeIdsToMerge === 'string' ? variables.chargeIdsToMerge : variables.chargeIdsToMerge.join('|')}`;
      return new Promise<Charge>((resolve, reject) => {
        notifications.show({
          id: notificationId,
          loading: true,
          title: 'Merging Charges',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables).then(res => {
          const message = `Error merging into charge ID [${variables.baseChargeID}]`;
          const data = handleKnownErrors(res, reject, message, notificationId);
          if (!data) {
            return;
          }
          if (data.mergeCharges.__typename === 'CommonError') {
            console.error(`${message}: ${data.mergeCharges.message}`);
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(data.mergeCharges.message);
          }
          notifications.update({
            id: notificationId,
            title: 'Update Success!',
            autoClose: 5000,
            message: 'Charges were merged',
            withCloseButton: true,
          });
          return resolve(data.mergeCharges.charge);
        });
      });
    },
    [handleKnownErrors, mutate],
  );

  return {
    fetching,
    mergeCharges,
  };
};
