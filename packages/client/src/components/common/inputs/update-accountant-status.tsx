import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, Clock, X } from 'lucide-react';
import { AccountantStatus } from '../../../gql/graphql.js';
import { useUpdateBusinessTripAccountantApproval } from '../../../hooks/use-update-business-trip-accountant-approval.js';
import { useUpdateChargeAccountantApproval } from '../../../hooks/use-update-charge-accountant-approval.js';
import { Button } from '../../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu.js';

export const accountantApprovalOptions: Record<
  AccountantStatus,
  { icon: typeof Check; color: string; bgColor: string; label: string; value: AccountantStatus }
> = {
  [AccountantStatus.Approved]: {
    icon: Check,
    color: 'text-green-600',
    bgColor: 'hover:bg-green-50',
    label: 'Approved',
    value: AccountantStatus.Approved,
  },
  [AccountantStatus.Pending]: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'hover:bg-yellow-50',
    label: 'Pending',
    value: AccountantStatus.Pending,
  },
  [AccountantStatus.Unapproved]: {
    icon: X,
    color: 'text-red-600',
    bgColor: 'hover:bg-red-50',
    label: 'Unapproved',
    value: AccountantStatus.Unapproved,
  },
};

const getApprovalStatusConfig = (status: AccountantStatus) => accountantApprovalOptions[status];

export function UpdateAccountantStatus(props: {
  onChange?: () => void;
  chargeId?: string;
  businessTripId?: string;
  value?: AccountantStatus;
}): ReactNode {
  const { onChange, value } = props;
  const [status, setStatus] = useState(value ?? AccountantStatus.Unapproved);
  const { updateChargeAccountantApproval } = useUpdateChargeAccountantApproval();
  const { updateBusinessTripAccountantApproval } = useUpdateBusinessTripAccountantApproval();

  const approvalConfig = getApprovalStatusConfig(status);
  const ApprovalIcon = approvalConfig.icon;

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
      if (!result) {
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
    ],
  );

  useEffect(() => {
    if (value) {
      setStatus(value);
    }
  }, [value]);

  const isDisabled = !props.chargeId && !props.businessTripId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isDisabled}>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${approvalConfig.bgColor}`}
          title={approvalConfig.label}
          disabled={isDisabled}
        >
          <ApprovalIcon className={`h-3.5 w-3.5 ${approvalConfig.color}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem onClick={() => onStatusChange(AccountantStatus.Approved)}>
          <Check className="h-4 w-4 mr-2 text-green-600" />
          Approved
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange(AccountantStatus.Pending)}>
          <Clock className="h-4 w-4 mr-2 text-yellow-600" />
          Pending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange(AccountantStatus.Unapproved)}>
          <X className="h-4 w-4 mr-2 text-red-600" />
          Unapproved
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
