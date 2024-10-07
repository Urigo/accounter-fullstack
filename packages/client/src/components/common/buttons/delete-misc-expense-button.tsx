import { ReactElement, useState } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { useDeleteMiscExpense } from '../../../hooks/use-delete-misc-expense.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  miscExpenseId: string;
}

export function DeleteMiscExpenseButton({ miscExpenseId }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { deleteMiscExpense } = useDeleteMiscExpense();

  function onDelete(): void {
    deleteMiscExpense({
      id: miscExpenseId,
    });
    setOpened(false);
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        onConfirm={onDelete}
        title="Are you sure you want to delete this expense?"
      />
      <ActionIcon color="red" onClick={(): void => setOpened(true)}>
        <Trash size={20} />
      </ActionIcon>
    </>
  );
}
