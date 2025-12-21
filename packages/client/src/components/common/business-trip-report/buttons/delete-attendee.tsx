import { useCallback, type ReactElement } from 'react';
import { Trash } from 'lucide-react';
import { useDeleteBusinessTripAttendee } from '../../../../hooks/use-delete-business-trip-attendee.js';
import { Button } from '../../../ui/button.js';
import { Tooltip } from '../../index.js';
import { ConfirmationModal } from '../../modals/confirmation-modal.js';

export function DeleteAttendee(props: {
  businessTripId: string;
  attendeeId: string;
  onDelete?: () => void;
}): ReactElement {
  const { fetching, deleteBusinessTripAttendee } = useDeleteBusinessTripAttendee();

  const onExecute = useCallback(() => {
    deleteBusinessTripAttendee({
      fields: {
        businessTripId: props.businessTripId,
        attendeeId: props.attendeeId,
      },
    }).then(() => {
      props.onDelete?.();
    });
  }, [props, deleteBusinessTripAttendee]);

  return (
    <ConfirmationModal onConfirm={onExecute} title="Are you sure you want to remove attendee?">
      <Tooltip content="Remove Attendee">
        <Button variant="outline" size="icon" className="size-7.5 text-red-500" disabled={fetching}>
          <Trash className="size-5" />
        </Button>
      </Tooltip>
    </ConfirmationModal>
  );
}
