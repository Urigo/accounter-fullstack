import { ReactElement, useState } from 'react';
import { toast } from 'sonner';
import { Trash } from 'tabler-icons-react';
import { useDeleteMiscExpense } from '../../../hooks/use-delete-misc-expense.js';
import { ActionIcon } from '../../ui/action-icon.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  miscExpenseId: string;
  onChange?: () => void;
}

export function DeleteMiscExpenseButton({ miscExpenseId, onChange }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { deleteMiscExpense } = useDeleteMiscExpense();

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
      toast.error('Error', {
        description: message,
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
