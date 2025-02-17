import { ReactElement, useState } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { useDeleteMiscExpense } from '../../../hooks/use-delete-misc-expense.js';
import { useToast } from '../../ui/use-toast.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  miscExpenseId: string;
  onChange?: () => void;
}

export function DeleteMiscExpenseButton({ miscExpenseId, onChange }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { deleteMiscExpense } = useDeleteMiscExpense();
  const { toast } = useToast();

  async function onDelete(): Promise<void> {
    try {
      await deleteMiscExpense({
        id: miscExpenseId,
      });
      onChange?.();
      setOpened(false);
    } catch (error) {
      const message = 'Failed to delete misc expense';
      console.error(`${message}: ${error}`);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
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
