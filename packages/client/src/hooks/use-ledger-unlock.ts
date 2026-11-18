import { useCallback } from 'react';
import { LedgerUnlockDocument, type LedgerUnlockMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation LedgerUnlock($date: TimelessDate!, $reason: String!) {
    unlockLedger(date: $date, reason: $reason)
  }
`;

type UseLedgerUnlock = {
  fetching: boolean;
  ledgerUnlock: (variables: LedgerUnlockMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'ledgerUnlock';

export const useLedgerUnlock = (): UseLedgerUnlock => {
  const { fetching, execute } = useApiMutation({
    document: LedgerUnlockDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.date}`,
    loadingMessage: 'Reopening ledger',
    errorMessage: 'Error reopening ledger',
    select: data => data.unlockLedger,
    successToast: { description: 'Ledger was reopened' },
  });

  const ledgerUnlock = useCallback(
    async (variables: LedgerUnlockMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return {
    fetching,
    ledgerUnlock,
  };
};
