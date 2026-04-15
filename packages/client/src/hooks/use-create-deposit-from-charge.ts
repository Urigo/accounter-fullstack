import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { CreateDepositFromChargeDocument } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

type UseCreateDepositFromCharge = {
  creating: boolean;
  createDepositFromCharge: (variables: {
    chargeId: string;
    name: string;
  }) => Promise<string | null>;
};

const NOTIFICATION_ID = 'createDepositFromCharge';

export const useCreateDepositFromCharge = (): UseCreateDepositFromCharge => {
  const [{ fetching }, mutate] = useMutation(CreateDepositFromChargeDocument);

  const createDepositFromCharge = useCallback(
    async (variables: { chargeId: string; name: string }): Promise<string | null> => {
      const message = `Error creating deposit "${variables.name}" from charge`;
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Creating deposit', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Deposit created', {
            id: notificationId,
            description: `Deposit "${data.createDepositFromCharge.name}" (${data.createDepositFromCharge.currency}) created successfully`,
          });
          return data.createDepositFromCharge.id;
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
      return null;
    },
    [mutate],
  );

  return {
    creating: fetching,
    createDepositFromCharge,
  };
};
