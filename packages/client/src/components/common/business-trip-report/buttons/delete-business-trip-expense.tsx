import { useCallback, type ReactElement } from 'react';
import { Trash } from 'lucide-react';
import { useDeleteBusinessTripExpense } from '../../../../hooks/use-delete-business-trip-expense.js';
import { Button } from '../../../ui/button.js';
import { Tooltip } from '../../index.js';
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
      <Tooltip content="Remove Expense">
        <Button variant="outline" size="icon" className="size-7.5 text-red-500" disabled={fetching}>
          <Trash className="size-5" />
        </Button>
      </Tooltip>
    </ConfirmationModal>
  );
}
