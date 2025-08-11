import type { ReactElement } from 'react';
import { Trash } from 'lucide-react';
import { useDeleteCharge } from '../../../hooks/use-delete-charge.js';
import { Button } from '../../ui/button.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  chargeId: string;
}

export function DeleteChargeButton({ chargeId }: Props): ReactElement {
  const { deleteCharge } = useDeleteCharge();

  function onDelete(): void {
    deleteCharge({
      chargeId,
    });
  }

  return (
    <ConfirmationModal onConfirm={onDelete} title="Are you sure you want to delete this charge?">
      <Button className="size-7.5 text-red-500" variant="ghost">
        <Trash className="size-5" />
      </Button>
    </ConfirmationModal>
  );
}
