import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, VariablesOf } from '../graphql.js';

export const DeleteChargeDocument = graphql(`
  mutation DeleteCharge($chargeId: UUID!) {
    deleteCharge(chargeId: $chargeId)
  }
`);

type DeleteChargeMutationVariables = VariablesOf<typeof DeleteChargeDocument>;

type UseDeleteCharge = {
  fetching: boolean;
  deleteCharge: (variables: DeleteChargeMutationVariables) => Promise<boolean>;
};

export const useDeleteCharge = (): UseDeleteCharge => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const [{ fetching }, mutate] = useMutation(DeleteChargeDocument);

  return {
    fetching,
    deleteCharge: (variables: DeleteChargeMutationVariables): Promise<boolean> =>
      new Promise<boolean>((resolve, reject) => {
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error deleting charge ID [${variables.chargeId}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(`Error deleting charge ID [${variables.chargeId}]: No data returned`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.deleteCharge === false) {
            console.error(
              `Error deleting charge ID [${variables.chargeId}]: Received 'false' from server`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject("Received 'false' from server");
          }
          showNotification({
            title: 'Deletion Success!',
            message: 'Charge was deleted successfully! 🎉',
          });
          resolve(res.data.deleteCharge);
        });
      }),
  };
};
