import { ReactElement, useCallback } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDeleteDepreciationRecord } from '../../../hooks/use-delete-depreciation-record.js';
import { ConfirmationModal } from '../modals/confirmation-modal.jsx';

export function DeleteDepreciationRecord(props: {
  depreciationRecordId: string;
  onDelete?: () => void;
}): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);

  const { fetching, deleteDepreciationRecord } = useDeleteDepreciationRecord();

  const onExecute = useCallback(() => {
    deleteDepreciationRecord({
      depreciationRecordId: props.depreciationRecordId,
    }).then(() => {
      props.onDelete?.();
      close();
    });
  }, [props, deleteDepreciationRecord, close]);

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={close}
        onConfirm={onExecute}
        title="Are you sure you want to delete the depreciation record?"
      />
      <Tooltip label="Remove Depreciation">
        <ActionIcon variant="default" loading={fetching} size={30} onClick={open}>
          <Trash size={20} color="red" />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
