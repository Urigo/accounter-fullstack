import { ReactElement, useCallback } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDeleteBusinessTripExpense } from '../../../../hooks/use-delete-business-trip-expense.js';
import { ConfirmationModal } from '../../modals/confirmation-modal.js';

export function DeleteBusinessTripExpense(props: {
  businessTripExpenseId: string;
  onDelete?: () => void;
}): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);

  const { fetching, deleteBusinessTripExpense } = useDeleteBusinessTripExpense();

  const onExecute = useCallback(() => {
    deleteBusinessTripExpense({
      businessTripExpenseId: props.businessTripExpenseId,
    }).then(() => {
      props.onDelete?.();
      close();
    });
  }, [props, deleteBusinessTripExpense, close]);

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={close}
        onConfirm={onExecute}
        title="Are you sure you want to remove expense?"
      />
      <Tooltip label="Remove Expense">
        <ActionIcon variant="default" loading={fetching} size={30} onClick={open}>
          <Trash size={20} color="red" />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
