'use client';

import React, { useEffect, type ComponentProps } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '../../ui/button.jsx';
import { Calendar } from '../../ui/calendar.jsx';
import { Input } from '../../ui/input.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.jsx';

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

export function DatePickerInput({ value: date, onChange, disabled, ...props }: Props) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date | undefined>(date);
  const [value, setValue] = React.useState(formatDate(date));

  useEffect(() => {
    if (date) {
      setValue(formatDate(date));
    }
  }, [date]);

  return (
    <div className="relative flex gap-2">
      <Input
        {...props}
        disabled={disabled}
        value={value}
        onChange={e => {
          setValue(e.target.value);
          const date = e.target.value ? new Date(e.target.value) : undefined;
          if (isValidDate(date)) {
            onChange?.(date);
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date-picker"
            variant="ghost"
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
            disabled={disabled}
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">Select date</span>
          </Button>
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
            captionLayout="dropdown"
            month={month}
            onMonthChange={setMonth}
            onSelect={(date?: Date | null) => {
              onChange?.(date);
              setValue(formatDate(date ?? undefined));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
