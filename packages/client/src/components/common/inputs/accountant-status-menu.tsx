import type { ReactElement, ReactNode } from 'react';
import { Check, CircleDashed, Clock, X } from 'lucide-react';
import { AccountantStatus } from '../../../gql/graphql.js';
import { Button } from '../../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip.js';

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

/** Shown when there is no status to display yet. Selecting from the menu still works. */
const placeholderOption = {
  icon: CircleDashed,
  color: 'text-gray-400',
  bgColor: 'hover:bg-gray-50',
  label: 'No status',
};

const MENU_ORDER = [
  AccountantStatus.Approved,
  AccountantStatus.Pending,
  AccountantStatus.Unapproved,
] as const;

const SIZE_CLASSES = {
  default: { button: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
  compact: { button: 'h-5 w-5', icon: 'h-3 w-3' },
} as const;

export type AccountantStatusMenuSize = keyof typeof SIZE_CLASSES;

export interface AccountantStatusMenuProps {
  value: AccountantStatus | null;
  onChange: (status: AccountantStatus) => void;
  disabled?: boolean;
  /** Shown in a tooltip around the trigger. It also shows while the menu is disabled. */
  tooltip?: ReactNode;
  size?: AccountantStatusMenuSize;
}

/**
 * Presentational accountant-status dropdown: an icon button that opens a menu of the three
 * statuses. It owns no state and runs no mutations; callers decide what a selection does.
 */
export function AccountantStatusMenu({
  value,
  onChange,
  disabled = false,
  tooltip,
  size = 'default',
}: AccountantStatusMenuProps): ReactElement {
  const config = value ? accountantApprovalOptions[value] : placeholderOption;
  const Icon = config.icon;
  const sizeClasses = SIZE_CLASSES[size];

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="ghost"
          size="sm"
          className={`${sizeClasses.button} p-0 ${config.bgColor}`}
          title={tooltip == null ? config.label : undefined}
          aria-label={config.label}
          disabled={disabled}
          data-accountant-status-trigger=""
        >
          <Icon className={`${sizeClasses.icon} ${config.color}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {MENU_ORDER.map(status => {
          const option = accountantApprovalOptions[status];
          const OptionIcon = option.icon;
          return (
            <DropdownMenuItem key={status} onClick={() => onChange(status)}>
              <OptionIcon className={`h-4 w-4 mr-2 ${option.color}`} />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (tooltip == null) {
    return menu;
  }

  // A disabled button swallows pointer events, so the tooltip hangs off a wrapping span instead.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{menu}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
