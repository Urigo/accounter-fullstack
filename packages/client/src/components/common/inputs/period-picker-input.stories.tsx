import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MonthPickerInput } from './month-picker-input.js';
import type { PeriodRange } from './period-picker-input.js';
import { YearPickerInput } from './year-picker-input.js';

/**
 * These replaced `MonthPickerInput` / `YearPickerInput` from `@mantine/dates`. The stories
 * are driven by real state so selection, deselection and range completion actually work —
 * a static story would not show that a second click closes a range.
 */
function Harness({ children }: { children: ReactElement }): ReactElement {
  return <div className="w-80 p-6">{children}</div>;
}

const meta = {
  title: 'Inputs/PeriodPicker',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Month: Story = {
  render: function Render() {
    const [value, setValue] = useState<Date | null>(new Date(2026, 2, 1));
    return (
      <Harness>
        <MonthPickerInput label="VAT report month" value={value} onChange={setValue} />
      </Harness>
    );
  },
};

export const Year: Story = {
  render: function Render() {
    const [value, setValue] = useState<Date | null>(new Date(2026, 0, 1));
    return (
      <Harness>
        <YearPickerInput
          label="Report year"
          value={value}
          onChange={setValue}
          minDate={new Date(2010, 0, 1)}
          maxDate={new Date()}
        />
      </Harness>
    );
  },
};

/** `type="multiple"` — the reference-years case in the profit-and-loss filters. */
export const MultipleYears: Story = {
  render: function Render() {
    const [value, setValue] = useState<Date[]>([new Date(2024, 0, 1), new Date(2026, 0, 1)]);
    return (
      <Harness>
        <YearPickerInput
          type="multiple"
          label="Pick reference years"
          value={value}
          onChange={setValue}
          minDate={new Date(2010, 0, 1)}
          maxDate={new Date()}
        />
      </Harness>
    );
  },
};

/** `type="range"` — the salaries filter. Click twice to complete the range. */
export const MonthRange: Story = {
  render: function Render() {
    const [value, setValue] = useState<PeriodRange>([new Date(2026, 0, 1), new Date(2026, 5, 1)]);
    return (
      <Harness>
        <MonthPickerInput type="range" label="Salary months" value={value} onChange={setValue} />
      </Harness>
    );
  },
};

export const WithError: Story = {
  render: function Render() {
    return (
      <Harness>
        <MonthPickerInput label="VAT report month" required error="Required" />
      </Harness>
    );
  },
};

export const Disabled: Story = {
  render: function Render() {
    return (
      <Harness>
        <MonthPickerInput label="VAT report month" disabled value={new Date(2026, 2, 1)} />
      </Harness>
    );
  },
};
