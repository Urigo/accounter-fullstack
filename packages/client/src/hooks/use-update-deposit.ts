import { useCallback } from 'react';
import type { TimelessDateString } from '@/helpers/index.js';
import { UpdateDepositDocument } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

type UpdateDepositVars = {
  id: string;
  name?: string;
  openDate?: TimelessDateString;
  closeDate?: TimelessDateString | null;
};

type UseUpdateDeposit = {
  updating: boolean;
  updateDeposit: (variables: UpdateDepositVars) => Promise<boolean>;
};

const NOTIFICATION_ID = 'updateDeposit';

export const useUpdateDeposit = (): UseUpdateDeposit => {
  const { fetching, execute } = useApiMutation({
    document: UpdateDepositDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.id}`,
    loadingMessage: 'Updating deposit…',
    errorMessage: 'Error updating deposit',
    select: () => true,
    successToast: { title: 'Deposit updated' },
  });

  const updateDeposit = useCallback(
    async (variables: UpdateDepositVars) => (await execute(variables)) ?? false,
    [execute],
  );

  return { updating: fetching, updateDeposit };
};
