import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateChargeDocument,
  UpdateChargeMutation,
  UpdateChargeMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
  mutation UpdateCharge($chargeId: ID!, $fields: UpdateChargeInput!) {
    updateCharge(chargeId: $chargeId, fields: $fields) {
      __typename
      ... on Charge {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const useUpdateCharge = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateChargeDocument);

  return {
    fetching,
    updateCharge: (variables: UpdateChargeMutationVariables) =>
      new Promise<Extract<UpdateChargeMutation['updateCharge'], { __typename: 'Charge' }>>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating charge ID [${variables.chargeId}]: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(`Error updating charge ID [${variables.chargeId}]: No data returned`);
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject('No data returned');
            }
            if (res.data.updateCharge.__typename === 'CommonError') {
              console.error(
                `Error updating charge ID [${variables.chargeId}]: ${res.data.updateCharge.message}`,
              );
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject(res.data.updateCharge.message);
            }
            showNotification({
              title: 'Update Success!',
              message: 'Hey there, your update is awesome!',
            });
            return resolve(res.data.updateCharge);
          }),
      ),
  };
};
