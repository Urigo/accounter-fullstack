'use client';

import React, { useEffect, type ComponentProps } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group.js';
import { TIMELESS_DATE_REGEX, type TimelessDateString } from '@/helpers/index.js';
import { Calendar } from '../../ui/calendar.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';

function parseFullDateInput(value: string): TimelessDateString | undefined {
  if (!TIMELESS_DATE_REGEX.test(value)) {
    return undefined;
  }

  return value as TimelessDateString;
}

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value?: TimelessDateString;
  onChange?: (date?: TimelessDateString | null) => void;
};

export function DatePickerInput({
  value: valueDate,
  onChange,
  disabled,
  id = 'date-input',
  ...props
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<TimelessDateString | undefined>(valueDate);
  const [month, setMonth] = React.useState<Date | undefined>(date ? new Date(date) : undefined);
  const [value, setValue] = React.useState(date ?? '');
  const invalidStructure = value.trim() !== '' && !parseFullDateInput(value);
  const invalidMessageId = `${id}-date-format-error`;
  const describedBy = [
    typeof props['aria-describedby'] === 'string' ? props['aria-describedby'] : undefined,
    invalidStructure ? invalidMessageId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    const externalDate = valueDate ?? null;
    const internalDate = date ?? null;

    if (externalDate !== internalDate) {
      setDate(valueDate);
      setMonth(valueDate ? new Date(valueDate) : undefined);
      setValue(valueDate ?? '');
    }
  }, [valueDate, date]);

  return (
    <div className="space-y-1">
      <InputGroup>
        <InputGroupInput
          {...props}
          disabled={disabled}
          id={id}
          value={value}
          placeholder="Select date"
          aria-invalid={invalidStructure}
          aria-describedby={describedBy || undefined}
          onChange={e => {
            const nextValue = e.target.value;

            setValue(nextValue);

            if (nextValue.trim() === '') {
              setDate(undefined);
              onChange?.(null);
              return;
            }

            const nextDate = parseFullDateInput(nextValue);

            if (nextDate) {
              setDate(nextDate);
              setMonth(nextDate ? new Date(nextDate) : undefined);
              onChange?.(nextDate);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <InputGroupButton variant="ghost" size="icon-xs" aria-label="Select date">
                <CalendarIcon />
                <span className="sr-only">Select date</span>
              </InputGroupButton>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="end"
              alignOffset={-8}
              sideOffset={10}
            >
              <Calendar
                mode="single"
                selected={date ? new Date(date) : undefined}
                month={month}
                onMonthChange={setMonth}
                onSelect={(date?: Date | null) => {
                  const newDate = date
                    ? (format(date, 'yyyy-MM-dd') as TimelessDateString)
                    : undefined;
                  setValue(newDate ?? '');
                  setDate(newDate);
                  onChange?.(newDate ?? null);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
      {invalidStructure ? (
        <p id={invalidMessageId} className="text-destructive text-xs">
          Date must use YYYY-MM-DD format.
        </p>
      ) : null}
    </div>
  );
}
