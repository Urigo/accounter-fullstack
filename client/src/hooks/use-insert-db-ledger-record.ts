import { showNotification } from '@mantine/notifications';
import { useMutation } from 'urql';
import {
  InsertDbLedgerRecordDocument,
  InsertDbLedgerRecordMutation,
  InsertDbLedgerRecordMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
  mutation InsertDbLedgerRecord($chargeId: ID!, $record: InsertDbLedgerRecordInput!) {
    insertDbLedgerRecord(chargeId: $chargeId, record: $record) {
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

export const useInsertDbLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertDbLedgerRecordDocument);

  return {
    fetching,
    insertDbLedgerRecord: (variables: InsertDbLedgerRecordMutationVariables) =>
      new Promise<
        Extract<InsertDbLedgerRecordMutation['insertDbLedgerRecord'], { __typename: 'Charge' }>
      >((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error inserting ledger record to charge ID [${variables.chargeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error inserting ledger record to charge ID [${variables.chargeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.insertDbLedgerRecord.__typename === 'CommonError') {
            console.error(
              `Error inserting ledger record to charge ID [${variables.chargeId}]: ${res.data.insertDbLedgerRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.insertDbLedgerRecord.message);
          }
          showNotification({
            title: 'Insert Success!',
            message: 'Your ledger record was added! 🎉',
          });
          return resolve(res.data.insertDbLedgerRecord);
        }),
      ),
  };
};
