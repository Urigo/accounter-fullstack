import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  RegenerateLedgerDocument,
  RegenerateLedgerMutation,
  RegenerateLedgerMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  regenerateLedgerRecords: (variables: RegenerateLedgerMutationVariables) => Promise<Ledger | void>;
};

const NOTIFICATION_ID = 'regenerateLedgerRecords';

export const useRegenerateLedgerRecords = (): UseRegenerateLedgerRecords => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(RegenerateLedgerDocument);
  const regenerateLedgerRecords = useCallback(
    async (variables: RegenerateLedgerMutationVariables) => {
      const message = 'Error regenerating ledger';
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Regenerating Ledger', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'regenerateLedgerRecords');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Ledger records were regenerated',
          });
          return data.regenerateLedgerRecords;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    regenerateLedgerRecords,
  };
};
