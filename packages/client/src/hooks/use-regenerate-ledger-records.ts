import { useCallback } from 'react';
import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  RegenerateLedgerDocument,
  RegenerateLedgerMutation,
  RegenerateLedgerMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
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
`;

type Ledger = Extract<
  RegenerateLedgerMutation['regenerateLedgerRecords'],
  { __typename: 'Ledger' }
>;

type UseRegenerateLedgerRecords = {
  fetching: boolean;
  regenerateLedgerRecords: (variables: RegenerateLedgerMutationVariables) => Promise<Ledger>;
};

const NOTIFICATION_ID = 'regenerateLedgerRecords';

export const useRegenerateLedgerRecords = (): UseRegenerateLedgerRecords => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(RegenerateLedgerDocument);

  const regenerate = useCallback(
    (variables: RegenerateLedgerMutationVariables): Promise<Ledger> => {
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      return new Promise<Ledger>((resolve, reject) => {
        notifications.show({
          id: notificationId,
          loading: true,
          title: 'Regenerating Ledger',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables).then(res => {
          if (res.error) {
            const message = 'Error regenerating ledger';
            console.error(`${message} for charge ID [${variables.chargeId}]: ${res.error}`);
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            const message = 'Error regenerating ledger';
            console.error(`${message}: No data received`);
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(message);
          }
          if (res.data.regenerateLedgerRecords.__typename === 'CommonError') {
            const message = 'Error regenerating ledger';
            console.error(`${message}: ${res.data.regenerateLedgerRecords.message}`);
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(res.data.regenerateLedgerRecords.message);
          }
          notifications.update({
            id: notificationId,
            title: 'Regenerate Successful!',
            autoClose: 5000,
            message: 'Ledger records were regenerated',
            withCloseButton: true,
          });
          return resolve(res.data.regenerateLedgerRecords);
        });
      });
    },
    [mutate],
  );

  return {
    fetching,
    regenerateLedgerRecords: (variables: RegenerateLedgerMutationVariables): Promise<Ledger> =>
      regenerate(variables),
  };
};
