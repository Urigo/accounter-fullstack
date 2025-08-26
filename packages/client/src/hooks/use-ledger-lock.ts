import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { LedgerLockDocument, type LedgerLockMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation LedgerLock($date: TimelessDate!) {
    lockLedgerRecords(date: $date)
  }
`;

type UseLedgerLock = {
  fetching: boolean;
  ledgerLock: (variables: LedgerLockMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'ledgerLock';

export const useLedgerLock = (): UseLedgerLock => {
  // TODO: add authentication
  // TODO: add local data update method after upload

  const [{ fetching }, mutate] = useMutation(LedgerLockDocument);
  const ledgerLock = useCallback(
    async (variables: LedgerLockMutationVariables) => {
      const message = 'Error locking ledger';
      const notificationId = `${NOTIFICATION_ID}-${variables.date}`;
      toast.loading('Locking ledger', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'lockLedgerRecords');
        if (data?.lockLedgerRecords) {
          toast.success('Success', {
            id: notificationId,
            description: 'Payroll file added',
          });
          return data.lockLedgerRecords;
        }
        throw new Error('Server error');
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return false;
    },
    [mutate],
  );

  return {
    fetching,
    ledgerLock,
  };
};
