import { ReactElement } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { useDeleteCharge } from '../../../hooks/use-delete-charge.js';
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
      <ActionIcon color="red">
        <Trash size={20} />
      </ActionIcon>
    </ConfirmationModal>
  );
}
