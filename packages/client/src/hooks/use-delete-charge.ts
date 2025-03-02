import { useCallback } from 'react';
import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import { DeleteChargeDocument, DeleteChargeMutationVariables } from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteCharge($chargeId: UUID!) {
    deleteCharge(chargeId: $chargeId)
  }
`;

type UseDeleteCharge = {
  fetching: boolean;
  deleteCharge: (variables: DeleteChargeMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'deleteCharge';

export const useDeleteCharge = (): UseDeleteCharge => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const [{ fetching }, mutate] = useMutation(DeleteChargeDocument);
  const { handleKnownErrors } = useHandleKnownErrors();

  const deleteCharge = useCallback(
    async (variables: DeleteChargeMutationVariables): Promise<boolean> => {
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      return new Promise<boolean>((resolve, reject) => {
        notifications.show({
          id: notificationId,
          loading: true,
          title: 'Deleting charge',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables).then(res => {
          const message = `Error deleting charge ID [${variables.chargeId}]`;
          const data = handleKnownErrors(res, reject, message, notificationId);
          if (!data) {
            return;
          }
          if (data.deleteCharge === false) {
            console.error(`${message}: Received 'false' from server`);
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject("Received 'false' from server");
          }
          notifications.update({
            id: notificationId,
            title: 'Deletion Successful!',
            autoClose: 5000,
            message: 'Charge was deleted',
            withCloseButton: true,
          });
          resolve(data.deleteCharge);
        });
      });
    },
    [handleKnownErrors, mutate],
  );

  return {
    fetching,
    deleteCharge,
  };
};
