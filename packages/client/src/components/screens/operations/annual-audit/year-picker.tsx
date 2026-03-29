import type { ReactElement } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';

const MIN_YEAR = 2000;
const MAX_YEAR = new Date().getFullYear();

function clampYear(year: number, minYear: number, maxYear: number): number {
  return Math.min(Math.max(year, minYear), maxYear);
}

interface YearPickerProps {
  value?: number;
  onChange: (value: number) => void;
  minYear?: number;
  maxYear?: number;
}

export function YearPicker({
  value,
  onChange,
  minYear = MIN_YEAR,
  maxYear = MAX_YEAR,
}: YearPickerProps): ReactElement {
  const selectedYear = typeof value === 'number' ? clampYear(value, minYear, maxYear) : undefined;
  const availableYears = Array.from({ length: maxYear - minYear + 1 }, (_, index) =>
    String(maxYear - index),
  );

  return (
    <Select
      value={selectedYear ? String(selectedYear) : undefined}
      onValueChange={year => onChange(Number(year))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={`Select year (${minYear}-${maxYear})`} />
      </SelectTrigger>
      <SelectContent>
        {availableYears.map(year => (
          <SelectItem key={year} value={year}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
