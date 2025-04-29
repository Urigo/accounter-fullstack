import { ReactElement, useCallback } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDeleteBusinessTripExpense } from '../../../../hooks/use-delete-business-trip-expense.js';
import { ConfirmationModal } from '../../modals/confirmation-modal.js';

export function DeleteBusinessTripExpense(props: {
  businessTripExpenseId: string;
  onDelete?: () => void;
}): ReactElement {
  const { fetching, deleteBusinessTripExpense } = useDeleteBusinessTripExpense();

  const onExecute = useCallback(() => {
    deleteBusinessTripExpense({
      businessTripExpenseId: props.businessTripExpenseId,
    }).then(() => {
      props.onDelete?.();
    });
  }, [props, deleteBusinessTripExpense]);

  return (
    <ConfirmationModal onConfirm={onExecute} title="Are you sure you want to remove expense?">
      <Tooltip label="Remove Expense">
        <ActionIcon variant="default" loading={fetching} size={30}>
          <Trash size={20} color="red" />
        </ActionIcon>
      </Tooltip>
    </ConfirmationModal>
  );
}
