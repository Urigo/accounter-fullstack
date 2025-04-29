import { ReactElement } from 'react';
import { toast } from 'sonner';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { useDeleteMiscExpense } from '../../../hooks/use-delete-misc-expense.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  miscExpenseId: string;
  onChange?: () => void;
}

export function DeleteMiscExpenseButton({ miscExpenseId, onChange }: Props): ReactElement {
  const { deleteMiscExpense } = useDeleteMiscExpense();

  async function onDelete(): Promise<void> {
    try {
      await deleteMiscExpense({
        id: miscExpenseId,
      });
      onChange?.();
    } catch (error) {
      const message = 'Failed to delete misc expense';
      console.error(`${message}: ${error}`);
      toast.error('Error', {
        description: message,
      });
    }
  }

  return (
    <ConfirmationModal onConfirm={onDelete} title="Are you sure you want to delete this expense?">
      <ActionIcon color="red">
        <Trash size={20} />
      </ActionIcon>
    </ConfirmationModal>
  );
}
