import { showNotification } from '@mantine/notifications';
import { useMutation } from 'urql';
import {
  GenerateLedgerRecordsDocument,
  GenerateLedgerRecordsMutation,
  GenerateLedgerRecordsMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
  mutation GenerateLedgerRecords($chargeId: ID!) {
    generateLedgerRecords(chargeId: $chargeId) {
      __typename
      ... on Charge {
        id
        ledgerRecords {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const useGenerateLedgerRecords = () => {
  // TODO: add authentication
  // TODO: add local data update method after generate

  const [{ fetching }, mutate] = useMutation(GenerateLedgerRecordsDocument);

  return {
    fetching,
    generateLedger: (variables: GenerateLedgerRecordsMutationVariables) =>
      new Promise<
        Extract<GenerateLedgerRecordsMutation['generateLedgerRecords'], { __typename: 'Charge' }>
      >((resolve, reject) => {
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error generating ledger record to charge ID [${variables.chargeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error generating ledger record to charge ID [${variables.chargeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.generateLedgerRecords.__typename === 'CommonError') {
            console.error(
              `Error generating ledger record to charge ID [${variables.chargeId}]: ${res.data.generateLedgerRecords.message}}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.generateLedgerRecords.message);
          }
          showNotification({
            title: 'Generation Success!',
            message: `${res.data.generateLedgerRecords.ledgerRecords.length} ledger records were generated successfully! 🎉`,
          });
          resolve(res.data.generateLedgerRecords);
        });
      }),
  };
};
