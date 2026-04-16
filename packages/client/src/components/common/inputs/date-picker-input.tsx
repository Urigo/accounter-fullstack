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
    <InputGroup>
      <InputGroupInput
        {...props}
        disabled={disabled}
        id={id}
        value={value}
        placeholder="Select date"
        onChange={e => {
          const nextValue = e.target.value;
          const nextDate = new Date(nextValue);

          setValue(nextValue);

          if (nextValue.trim() === '') {
            setDate(undefined);
            onChange?.(null);
            return;
          }

          if (isValidDate(nextDate)) {
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
  );
}
