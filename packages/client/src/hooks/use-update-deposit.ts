import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import type { TimelessDateString } from '@/helpers/index.js';
import { UpdateDepositDocument } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateDeposit(
    $id: UUID!
    $name: String
    $openDate: TimelessDate
    $closeDate: TimelessDate
  ) {
    updateDeposit(id: $id, name: $name, openDate: $openDate, closeDate: $closeDate) {
      id
      name
      openDate
      closeDate
      isOpen
    }
  }
`;

type UseUpdateDeposit = {
  updating: boolean;
  updateDeposit: (variables: {
    id: string;
    name?: string;
    openDate?: TimelessDateString;
    closeDate?: TimelessDateString | null;
  }) => Promise<boolean>;
};

const NOTIFICATION_ID = 'updateDeposit';

export const useUpdateDeposit = (): UseUpdateDeposit => {
  const [{ fetching }, mutate] = useMutation(UpdateDepositDocument);

  const updateDeposit = useCallback(
    async (variables: {
      id: string;
      name?: string;
      openDate?: TimelessDateString;
      closeDate?: TimelessDateString | null;
    }): Promise<boolean> => {
      const message = 'Error updating deposit';
      const notificationId = `${NOTIFICATION_ID}-${variables.id}`;
      toast.loading('Updating deposit…', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Deposit updated', { id: notificationId });
          return true;
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
      return false;
    },
    [mutate],
  );

  return { updating: fetching, updateDeposit };
};
