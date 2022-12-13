import { showNotification } from '@mantine/notifications';
import { useMutation } from 'urql';
import {
  UpdateDbLedgerRecordDocument,
  UpdateDbLedgerRecordMutation,
  UpdateDbLedgerRecordMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
  mutation UpdateDbLedgerRecord($ledgerRecordId: ID!, $fields: UpdateDbLedgerRecordInput!) {
    updateDbLedgerRecord(ledgerRecordId: $ledgerRecordId, fields: $fields) {
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

export const useUpdateDbLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateDbLedgerRecordDocument);

  return {
    fetching,
    updateDbLedgerRecord: (variables: UpdateDbLedgerRecordMutationVariables) =>
      new Promise<
        Extract<
          UpdateDbLedgerRecordMutation['updateDbLedgerRecord'],
          { __typename: 'LedgerRecord' }
        >
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
          if (res.data.updateDbLedgerRecord.__typename === 'CommonError') {
            console.error(
              `Error updating ledger record ID [${variables.ledgerRecordId}]: ${res.data.updateDbLedgerRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.updateDbLedgerRecord.message);
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.updateDbLedgerRecord);
        }),
      ),
  };
};
