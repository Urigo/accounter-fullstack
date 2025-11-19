import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { CreateDepositDocument, type Currency } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreateDeposit($currency: Currency!) {
    createDeposit(currency: $currency) {
      id
      currency
      isOpen
    }
  }
`;

type UseCreateDeposit = {
  creating: boolean;
  createDeposit: (variables: { currency: Currency }) => Promise<string | null>;
};

const NOTIFICATION_ID = 'createDeposit';

export const useCreateDeposit = (): UseCreateDeposit => {
  const [{ fetching }, mutate] = useMutation(CreateDepositDocument);

  const createDeposit = useCallback(
    async (variables: { currency: Currency }): Promise<string | null> => {
      const message = `Error creating new deposit in currency ${variables.currency}`;
      const notificationId = `${NOTIFICATION_ID}-${variables.currency}`;
      toast.loading('Creating deposit', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Deposit created', {
            id: notificationId,
            description: `Deposit ${data.createDeposit.id} (${data.createDeposit.currency}) created successfully`,
          });
          return data.createDeposit.id;
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
    createDeposit,
  };
};
