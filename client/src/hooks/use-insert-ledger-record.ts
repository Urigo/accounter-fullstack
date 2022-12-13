import { showNotification } from '@mantine/notifications';
import { useMutation } from 'urql';
import {
  InsertLedgerRecordDocument,
  InsertLedgerRecordMutation,
  InsertLedgerRecordMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
  mutation InsertLedgerRecord($chargeId: ID!, $record: InsertLedgerRecordInput!) {
    insertLedgerRecord(chargeId: $chargeId, record: $record) {
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

export const useInsertLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertLedgerRecordDocument);

  return {
    fetching,
    insertLedgerRecord: (variables: InsertLedgerRecordMutationVariables) =>
      new Promise<
        Extract<InsertLedgerRecordMutation['insertLedgerRecord'], { __typename: 'Charge' }>
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
          if (res.data.insertLedgerRecord.__typename === 'CommonError') {
            console.error(
              `Error inserting ledger record to charge ID [${variables.chargeId}]: ${res.data.insertLedgerRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.insertLedgerRecord.message);
          }
          showNotification({
            title: 'Insert Success!',
            message: 'Your ledger record was added! 🎉',
          });
          return resolve(res.data.insertLedgerRecord);
        }),
      ),
  };
};
