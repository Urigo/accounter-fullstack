import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const RegenerateLedgerDocument = graphql(`
  mutation RegenerateLedger($chargeId: UUID!) {
    regenerateLedgerRecords(chargeId: $chargeId) {
      __typename
      ... on Ledger {
        records {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`);

type RegenerateLedgerMutationVariables = VariablesOf<typeof RegenerateLedgerDocument>;
type RegenerateLedgerMutation = ResultOf<typeof RegenerateLedgerDocument>;

type Ledger = Extract<
  RegenerateLedgerMutation['regenerateLedgerRecords'],
  { __typename: 'Ledger' }
>;

type UseRegenerateLedgerRecords = {
  fetching: boolean;
  regenerateLedgerRecords: (variables: RegenerateLedgerMutationVariables) => Promise<Ledger>;
};

export const useRegenerateLedgerRecords = (): UseRegenerateLedgerRecords => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(RegenerateLedgerDocument);

  return {
    fetching,
    regenerateLedgerRecords: (variables: RegenerateLedgerMutationVariables): Promise<Ledger> =>
      new Promise<Ledger>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error regenerating ledger for charge ID [${variables.chargeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error regenerating ledger for charge ID [${variables.chargeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.regenerateLedgerRecords.__typename === 'CommonError') {
            console.error(
              `Error regenerating ledger for charge ID [${variables.chargeId}]: ${res.data.regenerateLedgerRecords.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.regenerateLedgerRecords.message);
          }
          showNotification({
            title: 'Regenerate Success!',
            message: 'Ledger records were regenerated',
          });
          return resolve(res.data.regenerateLedgerRecords);
        }),
      ),
  };
};
