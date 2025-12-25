import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { AssignChargeToDepositDocument } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AssignChargeToDeposit($chargeId: UUID!, $depositId: String!) {
    assignChargeToDeposit(chargeId: $chargeId, depositId: $depositId) {
      id
      isOpen
      currentBalance {
        formatted
      }
      transactions {
        id
      }
    }
  }
`;

type AssignVars = { chargeId: string; depositId: string };

type UseAssignChargeToDeposit = {
  assigning: boolean;
  assignChargeToDeposit: (variables: AssignVars) => Promise<void>;
};

const NOTIFICATION_ID = 'assignChargeToDeposit';

export const useAssignChargeToDeposit = (): UseAssignChargeToDeposit => {
  const [{ fetching }, mutate] = useMutation(AssignChargeToDepositDocument);

  const assignChargeToDeposit = useCallback(
    async (variables: AssignVars) => {
      const message = `Error assigning charge ${variables.chargeId} to deposit ${variables.depositId}`;
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Assigning to deposit', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Charge assigned to deposit ${data.assignChargeToDeposit.id}`,
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
    assignChargeToDeposit,
  };
};
