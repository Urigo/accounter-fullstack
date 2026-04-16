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
import { Calendar } from '../../ui/calendar.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';

function formatDate(date: Date | undefined) {
  if (!date) {
    return '';
  }

  return format(date, 'yyyy-MM-dd');
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !Number.isNaN(date.getTime());
}

function parseFullDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  if (!isValidDate(parsedDate)) {
    return undefined;
  }

  if (format(parsedDate, 'yyyy-MM-dd') !== value) {
    return undefined;
  }

  return parsedDate;
}

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value?: Date;
  onChange?: (date?: Date | null) => void;
};

export function DatePickerInput({
  value: valueDate,
  onChange,
  disabled,
  id = 'date-input',
  ...props
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(valueDate);
  const [month, setMonth] = React.useState<Date | undefined>(date);
  const [value, setValue] = React.useState(formatDate(date));
  const invalidStructure = value.trim() !== '' && !parseFullDateInput(value);
  const invalidMessageId = `${id}-date-format-error`;
  const describedBy = [
    typeof props['aria-describedby'] === 'string' ? props['aria-describedby'] : undefined,
    invalidStructure ? invalidMessageId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    const externalDateTime = valueDate?.getTime() ?? null;
    const internalDateTime = date?.getTime() ?? null;

    if (externalDateTime !== internalDateTime) {
      setDate(valueDate);
      setMonth(valueDate);
      setValue(formatDate(valueDate));
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
              setMonth(nextDate);
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
              <InputGroupButton
                id="date-picker"
                variant="ghost"
                size="icon-xs"
                aria-label="Select date"
              >
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
                selected={date}
                month={month}
                onMonthChange={setMonth}
                onSelect={(date?: Date | null) => {
                  setValue(formatDate(date ?? undefined));
                  setDate(date ?? undefined);
                  onChange?.(date ?? null);
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
