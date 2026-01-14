import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Check, Clock, X } from 'lucide-react';
import { AccountantStatus } from '../../../gql/graphql.js';
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

const getApprovalStatusConfig = (status: AccountantStatus) => {
  switch (status) {
    case AccountantStatus.Approved:
      return accountantApprovalOptions[AccountantStatus.Approved];
    case AccountantStatus.Pending:
      return accountantApprovalOptions[AccountantStatus.Pending];
    case AccountantStatus.Unapproved:
      return accountantApprovalOptions[AccountantStatus.Unapproved];
  }
};

export function UpdateAccountantStatus(props: {
  onChange: (status: AccountantStatus) => void;
  chargeId: string;
  value?: AccountantStatus;
}): ReactElement {
  const { onChange, value } = props;
  const [status, setStatus] = useState(value ?? AccountantStatus.Unapproved);
  const { updateChargeAccountantApproval } = useUpdateChargeAccountantApproval();

  const approvalConfig = getApprovalStatusConfig(status);
  const ApprovalIcon = approvalConfig.icon;

  const onStatusChange = useCallback(
    async (status: AccountantStatus): Promise<void> => {
      setStatus(status);
      await updateChargeAccountantApproval({
        chargeId: props.chargeId,
        status,
      });
      onChange(status);
    },
    [onChange, props.chargeId, updateChargeAccountantApproval],
  );

  useEffect(() => {
    if (value) {
      setStatus(value);
    }
  }, [value]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${approvalConfig.bgColor}`}
          title={approvalConfig.label}
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
