import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { DeleteLedgerRecordDocument, DeleteLedgerRecordMutationVariables } from '../gql/graphql.js';

/* GraphQL */ `
  mutation DeleteLedgerRecord($ledgerRecordId: ID!) {
    deleteLedgerRecord(ledgerRecordId: $ledgerRecordId)
  }
`;

export const useDeleteLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const [{ fetching }, mutate] = useMutation(DeleteLedgerRecordDocument);

  return {
    fetching,
    deleteDocument: (variables: DeleteLedgerRecordMutationVariables) =>
      new Promise<boolean>((resolve, reject) => {
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error deleting ledger record ID [${variables.ledgerRecordId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error deleting ledger record ID [${variables.ledgerRecordId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.deleteLedgerRecord === false) {
            console.error(
              `Error deleting ledger record ID [${variables.ledgerRecordId}]: Received 'false' from server`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject("Received 'false' from server");
          }
          showNotification({
            title: 'Deletion Success!',
            message: 'Ledger record was deleted successfully! 🎉',
          });
          resolve(res.data.deleteLedgerRecord);
        });
      }),
  };
};
