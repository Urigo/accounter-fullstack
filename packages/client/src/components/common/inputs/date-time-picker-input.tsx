'use client';

import React, { useEffect } from 'react';
import { format, isValid, parse, startOfDay } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group.js';
import { Calendar } from '../../ui/calendar.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';

const DISPLAY_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function parseInput(value: string): Date | undefined {
  if (!DATETIME_PATTERN.test(value)) return undefined;
  const parsed = parse(value, DISPLAY_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

type Props = Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  value?: Date | null;
  onChange?: (date?: Date | null) => void;
};

export function DateTimePickerInput({ value: valueProp, onChange, disabled, id, ...props }: Props) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date | undefined>(valueProp ?? undefined);
  const [textValue, setTextValue] = React.useState(
    valueProp ? format(valueProp, DISPLAY_FORMAT) : '',
  );
  const invalidStructure = textValue.trim() !== '' && !parseInput(textValue);
  const invalidMessageId = `${inputId}-datetime-format-error`;

  useEffect(() => {
    setTextValue(valueProp ? format(valueProp, DISPLAY_FORMAT) : '');
    if (valueProp) setMonth(valueProp);
  }, [valueProp]);

  return (
    <div className="space-y-1">
      <InputGroup>
        <InputGroupInput
          {...props}
          disabled={disabled}
          id={inputId}
          value={textValue}
          placeholder="YYYY-MM-DD HH:mm:ss"
          aria-invalid={invalidStructure || undefined}
          aria-describedby={invalidStructure ? invalidMessageId : undefined}
          onChange={e => {
            const next = e.target.value;
            setTextValue(next);

            if (next.trim() === '') {
              onChange?.(null);
              return;
            }

            const parsed = parseInput(next);
            if (parsed) {
              setMonth(parsed);
              onChange?.(parsed);
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
              <InputGroupButton variant="ghost" size="icon-xs" aria-label="Select date and time">
                <CalendarIcon />
                <span className="sr-only">Select date and time</span>
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
                selected={valueProp ?? undefined}
                month={month}
                onMonthChange={setMonth}
                onSelect={(selected?: Date | null) => {
                  if (!selected) {
                    onChange?.(null);
                    setOpen(false);
                    return;
                  }
                  const base = valueProp ?? startOfDay(new Date());
                  const newDate = new Date(
                    selected.getFullYear(),
                    selected.getMonth(),
                    selected.getDate(),
                    base.getHours(),
                    base.getMinutes(),
                    base.getSeconds(),
                  );
                  setTextValue(format(newDate, DISPLAY_FORMAT));
                  setMonth(newDate);
                  onChange?.(newDate);
                  setOpen(false);
                }}
              />
              <div className="flex gap-2 border-t p-2">
                <TimeSpinner
                  label="Hours"
                  value={valueProp ? valueProp.getHours() : 0}
                  max={23}
                  onChange={h => {
                    const base = valueProp ?? startOfDay(new Date());
                    const d = new Date(
                      base.getFullYear(),
                      base.getMonth(),
                      base.getDate(),
                      h,
                      base.getMinutes(),
                      base.getSeconds(),
                    );
                    setTextValue(format(d, DISPLAY_FORMAT));
                    onChange?.(d);
                  }}
                />
                <TimeSpinner
                  label="Minutes"
                  value={valueProp ? valueProp.getMinutes() : 0}
                  max={59}
                  onChange={m => {
                    const base = valueProp ?? startOfDay(new Date());
                    const d = new Date(
                      base.getFullYear(),
                      base.getMonth(),
                      base.getDate(),
                      base.getHours(),
                      m,
                      base.getSeconds(),
                    );
                    setTextValue(format(d, DISPLAY_FORMAT));
                    onChange?.(d);
                  }}
                />
                <TimeSpinner
                  label="Seconds"
                  value={valueProp ? valueProp.getSeconds() : 0}
                  max={59}
                  onChange={s => {
                    const base = valueProp ?? startOfDay(new Date());
                    const d = new Date(
                      base.getFullYear(),
                      base.getMonth(),
                      base.getDate(),
                      base.getHours(),
                      base.getMinutes(),
                      s,
                    );
                    setTextValue(format(d, DISPLAY_FORMAT));
                    onChange?.(d);
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
      {invalidStructure ? (
        <p id={invalidMessageId} className="text-destructive text-xs">
          Date must use YYYY-MM-DD HH:mm:ss format.
        </p>
      ) : null}
    </div>
  );
}

function TimeSpinner({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (!Number.isNaN(v) && v >= 0 && v <= max) onChange(v);
        }}
        className="w-12 rounded border px-1 py-0.5 text-center text-sm"
      />
    </div>
  );
}
