import { useState } from 'react';
import { ActionIcon } from '@mantine/core';
import { Trash } from 'tabler-icons-react';
import { useDeleteLedgerRecord } from '../../../hooks/use-delete-ledger-record';
import { ConfirmationModal } from '../../common';

interface Props {
  ledgerRecordId: string;
}

export function DeleteLedgerRecordButton({ ledgerRecordId }: Props) {
  const [opened, setOpened] = useState(false);
  const { mutate } = useDeleteLedgerRecord();

  function onDelete() {
    mutate({
      ledgerRecordId,
    });
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={() => setOpened(false)}
        onConfirm={onDelete}
        title="Are you sure you want to delete this ledger record?"
      />
      <ActionIcon color="red" onClick={() => setOpened(true)}>
        <Trash size={20} />
      </ActionIcon>
    </>
  );
}
