import React, { useEffect, type ReactElement, type ReactNode } from 'react';
import { CalendarIcon } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group.js';
import { Label } from '@/components/ui/label.js';
import { usePortalContainer } from '../../../providers/portal-container.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';

/** Selection modes carried over from Mantine's pickers. */
export type PeriodPickerType = 'default' | 'multiple' | 'range';
export type PeriodRange = [Date | null, Date | null];
export type PeriodValue = Date | null | Date[] | PeriodRange;

type BaseProps = {
  label?: string;
  error?: ReactNode;
  minDate?: Date;
  maxDate?: Date;
  /** Where the grid opens, when nothing is selected yet. */
  defaultDate?: Date;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
  onBlur?: () => void;
};

export type SinglePickerProps = BaseProps & {
  type?: 'default';
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (value: Date | null) => void;
};

export type MultiplePickerProps = BaseProps & {
  type: 'multiple';
  value?: Date[];
  defaultValue?: Date[];
  onChange?: (value: Date[]) => void;
};

export type RangePickerProps = BaseProps & {
  type: 'range';
  value?: PeriodRange;
  defaultValue?: PeriodRange;
  onChange?: (value: PeriodRange) => void;
};

export type PeriodPickerInputProps = SinglePickerProps | MultiplePickerProps | RangePickerProps;

/** Normalises whichever shape `value` takes into the flat list the grids render from. */
function toList(value: PeriodValue | undefined): Date[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    // A range carries nulls for its open end; the grids only render real dates.
    return (value as (Date | null)[]).filter((date): date is Date => date instanceof Date);
  }
  return [value];
}

type ShellProps = {
  props: PeriodPickerInputProps;
  /** How a selected period reads in the closed input. */
  format: (date: Date) => string;
  /** Collapses a clicked cell to its canonical instant (start of month / start of year). */
  normalise: (date: Date) => Date;
  renderPanel: (args: {
    value: Date[];
    onSelect: (date: Date) => void;
    range?: PeriodRange;
  }) => ReactNode;
};

/**
 * Input + popover shell shared by `MonthPickerInput` and `YearPickerInput`. Mirrors
 * `date-picker-input.tsx` — same InputGroup trigger and the same `usePortalContainer`
 * handling, without which the grid is unusable inside a drawer.
 *
 * The field is read-only: unlike a full date, a month or year is quicker to click than to
 * type, and free text would need its own parser per granularity.
 */
export function PeriodPickerInputShell({
  props,
  format,
  normalise,
  renderPanel,
}: ShellProps): ReactElement {
  const {
    label,
    error,
    className,
    disabled,
    required,
    placeholder,
    name,
    id,
    onBlur,
    type = 'default',
  } = props;
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [open, setOpen] = React.useState(false);
  // See date-picker-input.tsx: a popover portaled to document.body sits outside a drawer's
  // focus scope, so its buttons cannot be clicked.
  const portalContainer = usePortalContainer();

  const isControlled = props.value !== undefined;
  const [internal, setInternal] = React.useState<PeriodValue | undefined>(props.defaultValue);
  const current = isControlled ? props.value : internal;

  useEffect(() => {
    if (isControlled) {
      setInternal(props.value);
    }
  }, [isControlled, props.value]);

  const selected = toList(current);

  function commit(next: PeriodValue) {
    if (!isControlled) {
      setInternal(next);
    }
    // The union is resolved by `type`, which the call site and the handler agree on.
    (props.onChange as ((value: PeriodValue) => void) | undefined)?.(next);
  }

  function handleSelect(rawDate: Date) {
    const date = normalise(rawDate);

    if (type === 'multiple') {
      const existing = selected;
      const isSelected = existing.some(item => item.getTime() === date.getTime());
      commit(
        isSelected
          ? existing.filter(item => item.getTime() !== date.getTime())
          : [...existing, date].sort((a, b) => a.getTime() - b.getTime()),
      );
      return;
    }

    if (type === 'range') {
      const [from, to] = (current as PeriodRange | undefined) ?? [null, null];
      // A complete range starts over; an open one closes, ordering the endpoints.
      if (!from || to) {
        commit([date, null]);
        return;
      }
      commit(date.getTime() < from.getTime() ? [date, from] : [from, date]);
      setOpen(false);
      return;
    }

    commit(date);
    setOpen(false);
  }

  const display =
    type === 'range'
      ? selected.map(format).join(' – ')
      : type === 'multiple'
        ? selected.map(format).join(', ')
        : (selected[0] && format(selected[0])) || '';

  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={inputId} className="mb-1">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </Label>
      ) : null}
      <Popover open={open} onOpenChange={setOpen} modal={!!portalContainer}>
        <InputGroup>
          <PopoverTrigger asChild>
            <InputGroupInput
              id={inputId}
              name={name}
              readOnly
              disabled={disabled}
              required={required}
              value={display}
              placeholder={placeholder ?? 'Select'}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              onBlur={onBlur}
              className="cursor-pointer"
            />
          </PopoverTrigger>
          <InputGroupAddon align="inline-end">
            <PopoverTrigger asChild>
              <InputGroupButton
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={label ?? 'Open picker'}
              >
                <CalendarIcon />
              </InputGroupButton>
            </PopoverTrigger>
          </InputGroupAddon>
        </InputGroup>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="start"
          sideOffset={8}
          container={portalContainer}
        >
          {renderPanel({
            value: selected,
            onSelect: handleSelect,
            range:
              type === 'range' ? ((current as PeriodRange | undefined) ?? undefined) : undefined,
          })}
        </PopoverContent>
      </Popover>
      {error ? (
        <p id={errorId} className="text-destructive mt-1 text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
