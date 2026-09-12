import { useCallback } from 'react';
import { CreateDepositFromChargeDocument } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreateDepositFromCharge($chargeId: UUID!, $name: String!) {
    createDepositFromCharge(chargeId: $chargeId, name: $name) {
      id
      name
      currency
      isOpen
    }
  }
`;

type CreateDepositFromChargeVars = { chargeId: string; name: string };

type UseCreateDepositFromCharge = {
  creating: boolean;
  createDepositFromCharge: (variables: CreateDepositFromChargeVars) => Promise<string | null>;
};

const NOTIFICATION_ID = 'createDepositFromCharge';

export const useCreateDepositFromCharge = (): UseCreateDepositFromCharge => {
  const { fetching, execute } = useApiMutation({
    document: CreateDepositFromChargeDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Creating deposit',
    errorMessage: variables => `Error creating deposit "${variables.name}" from charge`,
    select: data => data.createDepositFromCharge,
    successToast: deposit => ({
      title: 'Deposit created',
      description: `Deposit "${deposit.name}" (${deposit.currency}) created successfully`,
    }),
  });

  const createDepositFromCharge = useCallback(
    async (variables: CreateDepositFromChargeVars) => (await execute(variables))?.id ?? null,
    [execute],
  );

  return {
    creating: fetching,
    createDepositFromCharge,
  };
};
