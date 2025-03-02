import { useCallback } from 'react';
import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  RegenerateLedgerDocument,
  RegenerateLedgerMutation,
  RegenerateLedgerMutationVariables,
} from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

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
  const { handleKnownErrors } = useHandleKnownErrors();

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
          const message = 'Error regenerating ledger';
          const data = handleKnownErrors(res, reject, message, notificationId);
          if (!data) {
            return;
          }
          if (data.regenerateLedgerRecords.__typename === 'CommonError') {
            console.error(`${message}: ${data.regenerateLedgerRecords.message}`);
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(data.regenerateLedgerRecords.message);
          }
          notifications.update({
            id: notificationId,
            title: 'Regenerate Successful!',
            autoClose: 5000,
            message: 'Ledger records were regenerated',
            withCloseButton: true,
          });
          return resolve(data.regenerateLedgerRecords);
        });
      });
    },
    [mutate, handleKnownErrors],
  );

  return {
    fetching,
    regenerateLedgerRecords: (variables: RegenerateLedgerMutationVariables): Promise<Ledger> =>
      regenerate(variables),
  };
};
