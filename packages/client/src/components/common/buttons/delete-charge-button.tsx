import { ReactElement, useState } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { useDeleteCharge } from '../../../hooks/use-delete-charge.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  chargeId: string;
}

export function DeleteChargeButton({ chargeId }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { deleteCharge } = useDeleteCharge();

  function onDelete(): void {
    deleteCharge({
      chargeId,
    });
    setOpened(false);
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        onConfirm={onDelete}
        title="Are you sure you want to delete this charge?"
      />
      <ActionIcon color="red" onClick={(): void => setOpened(true)}>
        <Trash size={20} />
      </ActionIcon>
    </>
  );
}
