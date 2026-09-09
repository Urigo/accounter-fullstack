import type { ReactElement } from 'react';
import { format as formatDate } from 'date-fns';
import { MonthPicker, startOfMonth } from '../../ui/period-picker.js';
import { PeriodPickerInputShell, type PeriodPickerInputProps } from './period-picker-input.js';

export type MonthPickerInputProps = PeriodPickerInputProps;

/** Month-granularity picker. Replaces `MonthPickerInput` from `@mantine/dates`. */
export function MonthPickerInput(props: MonthPickerInputProps): ReactElement {
  const { minDate, maxDate, defaultDate } = props;
  return (
    <PeriodPickerInputShell
      props={props}
      normalise={startOfMonth}
      format={date => formatDate(date, 'MMM yyyy')}
      renderPanel={({ value, onSelect, range }) => (
        <MonthPicker
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
