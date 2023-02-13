import { useState } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { useDeleteLedgerRecord } from '../../../hooks/use-delete-ledger-record';
import { ConfirmationModal } from '../../common';

interface Props {
  ledgerRecordId: string;
}

export function DeleteLedgerRecordButton({ ledgerRecordId }: Props) {
  const [opened, setOpened] = useState(false);
  const { deleteDocument } = useDeleteLedgerRecord();

  function onDelete() {
    deleteDocument({
      ledgerRecordId,
    });
    setOpened(false);
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
