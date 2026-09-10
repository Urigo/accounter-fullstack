import { useCallback } from 'react';
import { LedgerLockDocument, type LedgerLockMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: LedgerLockDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.date}`,
    loadingMessage: 'Locking ledger',
    errorMessage: 'Error locking ledger',
    commonErrorPath: 'lockLedgerRecords',
    select: data => {
      if (!data.lockLedgerRecords) {
        throw new Error('Server error');
      }
      return data.lockLedgerRecords;
    },
    successToast: { description: 'Payroll file added' },
  });

  const ledgerLock = useCallback(
    async (variables: LedgerLockMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return {
    fetching,
    ledgerLock,
  };
};
