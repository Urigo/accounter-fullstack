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

export function DatePickerInput({ value: valueDate, onChange, disabled, ...props }: Props) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(valueDate);
  const [month, setMonth] = React.useState<Date | undefined>(date);
  const [value, setValue] = React.useState(formatDate(date));

  useEffect(() => {
    onChange?.(date ?? null);
  }, [date, onChange]);

  return (
    <InputGroup>
      <InputGroupInput
        {...props}
        disabled={disabled}
        id="date-required"
        value={value}
        placeholder="Select date"
        onChange={e => {
          const date = new Date(e.target.value);
          setValue(e.target.value);
          if (isValidDate(date)) {
            setDate(date);
            setMonth(date);
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
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}
