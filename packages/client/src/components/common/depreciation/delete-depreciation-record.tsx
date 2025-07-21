import { ReactElement, useCallback } from 'react';
import { Trash } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { useDeleteDepreciationRecord } from '../../../hooks/use-delete-depreciation-record.js';
import { Button } from '../../ui/button.js';
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
        <Button variant="outline" size="icon" className="size-7.5 text-red-500" disabled={fetching}>
          <Trash className="size-5" />
        </Button>
      </Tooltip>
    </ConfirmationModal>
  );
}
