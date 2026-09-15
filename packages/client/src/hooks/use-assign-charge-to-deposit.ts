import { AssignChargeToDepositDocument } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AssignChargeToDeposit($chargeId: UUID!, $depositId: String!) {
    assignChargeToDeposit(chargeId: $chargeId, depositId: $depositId) {
      id
    }
  }
`;

type AssignVars = { chargeId: string; depositId: string };

type UseAssignChargeToDeposit = {
  assigning: boolean;
  /** Resolves to the id of the deposit the charge was assigned to, or to nothing on failure. */
  assignChargeToDeposit: (variables: AssignVars) => Promise<string | void>;
};

const NOTIFICATION_ID = 'assignChargeToDeposit';

export const useAssignChargeToDeposit = (): UseAssignChargeToDeposit => {
  const { fetching, execute } = useApiMutation({
    document: AssignChargeToDepositDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Assigning to deposit',
    errorMessage: variables =>
      `Error assigning charge ${variables.chargeId} to deposit ${variables.depositId}`,
    select: data => data.assignChargeToDeposit.id,
    successToast: depositId => ({ description: `Charge assigned to deposit ${depositId}` }),
  });

  return {
    assigning: fetching,
    assignChargeToDeposit: execute,
  };
};
