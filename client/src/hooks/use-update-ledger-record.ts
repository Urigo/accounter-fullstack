import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateLedgerRecordDocument,
  UpdateLedgerRecordMutation,
  UpdateLedgerRecordMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
  mutation UpdateLedgerRecord($ledgerRecordId: ID!, $fields: UpdateLedgerRecordInput!) {
    updateLedgerRecord(ledgerRecordId: $ledgerRecordId, fields: $fields) {
      __typename
      ... on LedgerRecord {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const useUpdateLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateLedgerRecordDocument);

  return {
    fetching,
    UpdateLedgerRecord: (variables: UpdateLedgerRecordMutationVariables) =>
      new Promise<
        Extract<UpdateLedgerRecordMutation['updateLedgerRecord'], { __typename: 'LedgerRecord' }>
      >((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error updating ledger record ID [${variables.ledgerRecordId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error updating ledger record ID [${variables.ledgerRecordId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.updateLedgerRecord.__typename === 'CommonError') {
            console.error(
              `Error updating ledger record ID [${variables.ledgerRecordId}]: ${res.data.updateLedgerRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.updateLedgerRecord.message);
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.updateLedgerRecord);
        }),
      ),
  };
};
