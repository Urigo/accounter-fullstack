import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  MergeChargesDocument,
  MergeChargesMutation,
  MergeChargesMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation MergeCharges($baseChargeID: ID!, $chargeIdsToMerge: [ID!]!, $fields: UpdateChargeInput) {
    mergeCharges(baseChargeID: $baseChargeID, chargeIdsToMerge: $chargeIdsToMerge, fields: $fields) {
      __typename
      ... on CommonCharge {
        id
      }
      ... on ConversionCharge {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Charge = Extract<
  MergeChargesMutation['mergeCharges'],
  { __typename: 'CommonCharge' } | { __typename: 'ConversionCharge' }
>;

type UseMergeCharges = {
  fetching: boolean;
  mergeCharges: (variables: MergeChargesMutationVariables) => Promise<Charge>;
};

export const useMergeCharges = (): UseMergeCharges => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(MergeChargesDocument);

  return {
    fetching,
    mergeCharges: (variables: MergeChargesMutationVariables): Promise<Charge> =>
      new Promise<Charge>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error merging into charge ID [${variables.baseChargeID}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error merging into charge ID [${variables.baseChargeID}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.mergeCharges.__typename === 'CommonError') {
            console.error(
              `Error merging into charge ID [${variables.baseChargeID}]: ${res.data.mergeCharges.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.mergeCharges.message);
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.mergeCharges);
        }),
      ),
  };
};
