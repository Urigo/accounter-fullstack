import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';

/**
 * Month and year grids, the two pickers `ui/calendar.tsx` does not cover — react-day-picker
 * selects days, and has no month-only or year-only mode. Both replaced `@mantine/dates`.
 *
 * They deal in `Date` rather than the `TimelessDateString` used by `date-picker-input.tsx`,
 * because every call site already thinks in `Date` (`new Date(year, 0, 1)`, `date.getFullYear()`)
 * and converting at the boundary would have rewritten a dozen unrelated handlers.
 */

/** First instant of a month — the canonical form for a "month" value. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** First instant of a year — the canonical form for a "year" value. */
export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function sameYear(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear();
}

/** Inclusive on both ends, compared at the granularity the caller already normalised to. */
function withinBounds(date: Date, minDate?: Date, maxDate?: Date): boolean {
  if (minDate && date.getTime() < startOfMonth(minDate).getTime()) {
    return false;
  }
  if (maxDate && date.getTime() > startOfMonth(maxDate).getTime()) {
    return false;
  }
  return true;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, month) =>
  new Date(2000, month, 1).toLocaleString('default', { month: 'short' }),
);

type GridButtonProps = {
  label: string;
  selected: boolean;
  inRange: boolean;
  disabled: boolean;
  onClick: () => void;
};

function GridButton({ label, selected, inRange, disabled, onClick }: GridButtonProps) {
  return (
    <Button
      type="button"
      variant={selected ? 'default' : 'ghost'}
      size="sm"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn('w-full font-normal', inRange && !selected && 'bg-accent')}
    >
      {label}
    </Button>
  );
}

type PanelProps = {
  /** Selected periods, already normalised (start of month / start of year). */
  value: Date[];
  onSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  /** Highlights the span between two endpoints, for `type="range"`. */
  range?: [Date | null, Date | null];
  /** Uncontrolled starting position of the grid. */
  defaultDate?: Date;
  className?: string;
};

function isInRange(date: Date, range?: [Date | null, Date | null]): boolean {
  if (!range?.[0] || !range[1]) {
    return false;
  }
  const [from, to] = range;
  return date.getTime() > from.getTime() && date.getTime() < to.getTime();
}

/** Twelve months of one year, with year navigation. */
export function MonthPicker({
  value,
  onSelect,
  minDate,
  maxDate,
  range,
  defaultDate,
  className,
}: PanelProps) {
  const [year, setYear] = React.useState(() =>
    (defaultDate ?? value[0] ?? new Date()).getFullYear(),
  );

  return (
    <div className={cn('w-64 p-3', className)} data-slot="month-picker">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous year"
          onClick={() => setYear(y => y - 1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium" aria-live="polite">
          {year}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next year"
          onClick={() => setYear(y => y + 1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {MONTH_LABELS.map((label, month) => {
          const date = new Date(year, month, 1);
          return (
            <GridButton
              key={label}
              label={label}
              selected={value.some(selected => sameMonth(selected, date))}
              inRange={isInRange(date, range)}
              disabled={!withinBounds(date, minDate, maxDate)}
              onClick={() => onSelect(date)}
            />
          );
        })}
      </div>
    </div>
  );
}

const YEARS_PER_PAGE = 12;

/** A page of twelve years, with page navigation. */
export function YearPicker({
  value,
  onSelect,
  minDate,
  maxDate,
  range,
  defaultDate,
  className,
}: PanelProps) {
  const [firstYear, setFirstYear] = React.useState(() => {
    const anchor = (defaultDate ?? value[0] ?? new Date()).getFullYear();
    // Page the grid so the anchor year is on it, aligned to a stable boundary.
    return Math.floor(anchor / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  });

  const years = Array.from({ length: YEARS_PER_PAGE }, (_, index) => firstYear + index);

  return (
    <div className={cn('w-64 p-3', className)} data-slot="year-picker">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous years"
          onClick={() => setFirstYear(y => y - YEARS_PER_PAGE)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium" aria-live="polite">
          {years[0]} – {years[years.length - 1]}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next years"
          onClick={() => setFirstYear(y => y + YEARS_PER_PAGE)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {years.map(year => {
          const date = new Date(year, 0, 1);
          return (
            <GridButton
              key={year}
              label={String(year)}
              selected={value.some(selected => sameYear(selected, date))}
              inRange={isInRange(date, range)}
              disabled={!withinBounds(date, minDate, maxDate)}
              onClick={() => onSelect(date)}
            />
          );
        })}
      </div>
    </div>
  );
}
