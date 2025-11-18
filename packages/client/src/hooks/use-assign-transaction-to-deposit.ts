import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { AssignTransactionToDepositDocument } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AssignTransactionToDeposit($transactionId: UUID!, $depositId: String!) {
    assignTransactionToDeposit(transactionId: $transactionId, depositId: $depositId) {
      id
      isOpen
      balance {
        formatted
      }
      transactions {
        id
      }
    }
  }
`;

type AssignVars = { transactionId: string; depositId: string };

type UseAssignTransactionToDeposit = {
  assigning: boolean;
  assignTransactionToDeposit: (variables: AssignVars) => Promise<void>;
};

const NOTIFICATION_ID = 'assignTransactionToDeposit';

export const useAssignTransactionToDeposit = (): UseAssignTransactionToDeposit => {
  const [{ fetching }, mutate] = useMutation(AssignTransactionToDepositDocument);

  const assignTransactionToDeposit = useCallback(
    async (variables: AssignVars) => {
      const message = `Error assigning transaction ${variables.transactionId} to deposit ${variables.depositId}`;
      const notificationId = `${NOTIFICATION_ID}-${variables.transactionId}`;
      toast.loading('Assigning to deposit', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Transaction assigned to deposit ${data.assignTransactionToDeposit.id}`,
          });
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
    assigning: fetching,
    assignTransactionToDeposit,
  };
};
