import { ReactElement, useCallback } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDeleteDepreciationRecord } from '../../../hooks/use-delete-depreciation-record.js';
import { ConfirmationModal } from '../modals/confirmation-modal.jsx';

export function DeleteDepreciationRecord(props: {
  depreciationRecordId: string;
  onDelete?: () => void;
}): ReactElement {
  const { fetching, deleteDepreciationRecord } = useDeleteDepreciationRecord();

  const onExecute = useCallback(() => {
    deleteDepreciationRecord({
      depreciationRecordId: props.depreciationRecordId,
    }).then(() => {
      props.onDelete?.();
    });
  }, [props, deleteDepreciationRecord]);

  return (
    <ConfirmationModal
      onConfirm={onExecute}
      title="Are you sure you want to delete the depreciation record?"
    >
      <Tooltip label="Remove Depreciation">
        <ActionIcon variant="default" loading={fetching} size={30}>
          <Trash size={20} color="red" />
        </ActionIcon>
      </Tooltip>
    </ConfirmationModal>
  );
}
