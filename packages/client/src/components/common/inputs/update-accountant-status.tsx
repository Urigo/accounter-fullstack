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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu.js';

export const accountantApprovalOptions: Record<
  AccountantStatus,
  { icon: typeof Check; color: string; bgColor: string; label: string; value: AccountantStatus }
> = {
  [AccountantStatus.Approved]: {
    icon: Check,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
    label: 'Approved',
    value: AccountantStatus.Approved,
  },
  [AccountantStatus.Pending]: {
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'hover:bg-amber-50 dark:hover:bg-amber-950/40',
    label: 'Pending',
    value: AccountantStatus.Pending,
  },
  [AccountantStatus.Unapproved]: {
    icon: X,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'hover:bg-red-50 dark:hover:bg-red-950/40',
    label: 'Unapproved',
    value: AccountantStatus.Unapproved,
  },
};

const getApprovalStatusConfig = (status: AccountantStatus) => accountantApprovalOptions[status];

const STATUS_DOT: Record<AccountantStatus, string> = {
  [AccountantStatus.Approved]: 'bg-emerald-500',
  [AccountantStatus.Pending]: 'bg-amber-500',
  [AccountantStatus.Unapproved]: 'bg-red-500',
};

const STATUS_ORDER: AccountantStatus[] = [
  AccountantStatus.Approved,
  AccountantStatus.Pending,
  AccountantStatus.Unapproved,
];

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isDisabled}>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${approvalConfig.bgColor}`}
          // The status was conveyed by a coloured glyph with only a `title`, which is a description
          // rather than a name — down a list of a hundred records a screen reader announced a hundred
          // identical unnamed buttons.
          aria-label={`Approval status: ${approvalConfig.label}. Change status`}
          title={approvalConfig.label}
          disabled={isDisabled}
        >
          <ApprovalIcon aria-hidden className={`h-3.5 w-3.5 ${approvalConfig.color}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel variant="section">Set approval</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUS_ORDER.map(option => {
          const config = accountantApprovalOptions[option];
          return (
            <DropdownMenuItem
              key={option}
              onClick={() => onStatusChange(option)}
              className="gap-2 text-xs"
            >
              <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOT[option]}`} />
              <span className="font-medium">{config.label}</span>
              {/* Pending is not a step on the way to approved — it means an approved charge changed
                  underneath and lost its approval. Saying so here is cheaper than the support
                  question it otherwise generates. */}
              {option === AccountantStatus.Pending && (
                <span className="ml-auto text-[10px] text-muted-foreground">downgraded</span>
              )}
              {option === status && (
                <Check aria-hidden className="ml-auto size-3 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
