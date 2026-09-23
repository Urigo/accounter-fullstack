import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccountantStatus } from '../../../gql/graphql.js';
import { useUpdateBusinessTripAccountantApproval } from '../../../hooks/use-update-business-trip-accountant-approval.js';
import { useUpdateChargeAccountantApproval } from '../../../hooks/use-update-charge-accountant-approval.js';
import { AccountantStatusMenu } from './accountant-status-menu.js';

// Re-exported so existing imports from this module keep working.
export { accountantApprovalOptions } from './accountant-status-menu.js';

export function UpdateAccountantStatus(props: {
  onChange?: () => void;
  onStatusChange?: (status: AccountantStatus) => void;
  chargeId?: string;
  businessTripId?: string;
  value?: AccountantStatus;
}): ReactNode {
  const { onChange, onStatusChange: onStatusChangeProp, value } = props;
  const [status, setStatus] = useState(value ?? AccountantStatus.Unapproved);
  const { updateChargeAccountantApproval } = useUpdateChargeAccountantApproval();
  const { updateBusinessTripAccountantApproval } = useUpdateBusinessTripAccountantApproval();

  const onStatusChange = useCallback(
    async (newStatus: AccountantStatus): Promise<void> => {
      const oldStatus = status;
      setStatus(newStatus);
      let result: AccountantStatus | null | void = null;
      if (props.chargeId) {
        result = await updateChargeAccountantApproval({
          chargeId: props.chargeId,
          status: newStatus,
        });
      } else if (props.businessTripId) {
        result = await updateBusinessTripAccountantApproval({
          businessTripId: props.businessTripId,
          status: newStatus,
        });
      }
      if (result) {
        onStatusChangeProp?.(newStatus);
      } else {
        setStatus(oldStatus);
      }
      onChange?.();
    },
    [
      props.chargeId,
      updateChargeAccountantApproval,
      props.businessTripId,
      updateBusinessTripAccountantApproval,
      status,
      onChange,
      onStatusChangeProp,
    ],
  );

  useEffect(() => {
    if (value) {
      setStatus(value);
    }
  }, [value]);

  const isDisabled = !props.chargeId && !props.businessTripId;

  return (
    <AccountantStatusMenu
      value={status}
      onChange={newStatus => void onStatusChange(newStatus)}
      disabled={isDisabled}
    />
  );
}
