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

function clampYear(year: number): number {
  return Math.min(Math.max(year, MIN_YEAR), MAX_YEAR);
}

interface YearPickerProps {
  value?: number;
  onChange: (value: number) => void;
}

export function YearPicker({ value, onChange }: YearPickerProps): ReactElement {
  const selectedYear = typeof value === 'number' ? clampYear(value) : undefined;
  const availableYears = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) =>
    String(MAX_YEAR - index),
  );

  return (
    <Select
      value={selectedYear ? String(selectedYear) : undefined}
      onValueChange={year => onChange(Number(year))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={`Select year (${MIN_YEAR}-${MAX_YEAR})`} />
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
