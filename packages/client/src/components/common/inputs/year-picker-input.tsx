import type { ReactElement } from 'react';
import { startOfYear, YearPicker } from '../../ui/period-picker.js';
import { PeriodPickerInputShell, type PeriodPickerInputProps } from './period-picker-input.js';

export type YearPickerInputProps = PeriodPickerInputProps;

/** Year-granularity picker. Replaces `YearPickerInput` from `@mantine/dates`. */
export function YearPickerInput(props: YearPickerInputProps): ReactElement {
  const { minDate, maxDate, defaultDate } = props;
  return (
    <PeriodPickerInputShell
      props={props}
      normalise={startOfYear}
      format={date => String(date.getFullYear())}
      renderPanel={({ value, onSelect, range }) => (
        <YearPicker
          value={value}
          onSelect={onSelect}
          range={range}
          minDate={minDate}
          maxDate={maxDate}
          defaultDate={defaultDate}
        />
      )}
    />
  );
}
