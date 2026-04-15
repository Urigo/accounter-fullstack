import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import type { TimelessDateString } from '@/helpers/index.js';
import { CreateDepositDocument, type Currency } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreateDeposit(
    $name: String!
    $currency: Currency!
    $openDate: TimelessDate!
    $accountId: UUID
  ) {
    createDeposit(name: $name, currency: $currency, openDate: $openDate, accountId: $accountId) {
      id
      currency
      isOpen
    }
  }
`;

type UseCreateDeposit = {
  creating: boolean;
  createDeposit: (variables: {
    name: string;
    currency: Currency;
    openDate: TimelessDateString;
    accountId?: string;
  }) => Promise<string | null>;
};

const NOTIFICATION_ID = 'createDeposit';

export const useCreateDeposit = (): UseCreateDeposit => {
  const [{ fetching }, mutate] = useMutation(CreateDepositDocument);

  const createDeposit = useCallback(
    async (variables: {
      name: string;
      currency: Currency;
      openDate: TimelessDateString;
      accountId?: string;
    }): Promise<string | null> => {
      const message = `Error creating new deposit ${variables.name}`;
      const notificationId = `${NOTIFICATION_ID}-${variables.name}-${variables.currency}-${variables.openDate}-${variables.accountId ?? 'noAccount'}`;
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
