import { useEffect, useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NumberInput } from './number-input.js';

/**
 * Replaced Mantine's `NumberInput`. The `label` and `error` props were added for that
 * migration — Mantine rendered both, and the call sites under `common/forms` rely on them.
 */
function Harness(props: Parameters<typeof NumberInput>[0]): ReactElement {
  const [value, setValue] = useState<number | undefined>(props.value);

  // Storybook keeps the same Harness mounted when args change, so without this the field
  // would keep its first value while the controls panel says otherwise.
  useEffect(() => setValue(props.value), [props.value]);

  return (
    <div className="w-72 p-6">
      <NumberInput {...props} value={value} onChange={next => setValue(next ?? undefined)} />
    </div>
  );
}

const meta = {
  title: 'Inputs/NumberInput',
  component: Harness,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { value: 42 } };

/** Without a label or error the component renders the bare field, unwrapped. */
export const Bare: Story = { args: { value: 42, hideControls: true } };

export const WithLabel: Story = { args: { value: 1250, label: 'Base salary', hideControls: true } };

export const WithError: Story = {
  args: { value: 0, label: 'Amount', error: 'Must be greater than zero', hideControls: true },
};

/** `suffix` replaced Mantine's `rightSection`, which was only ever a unit string. */
export const WithSuffix: Story = {
  args: { value: 6.5, label: 'Pension employee percentage', suffix: '%', hideControls: true },
};

/**
 * `decimalScale` alone caps decimals without padding — the mapping for Mantine's
 * `precision` + `removeTrailingZeros`. Adding `fixedDecimalScale` pads instead, which is
 * what bare `precision` did.
 */
export const DecimalHandling: Story = {
  args: {
    value: 1234.5,
    label: 'Amount',
    decimalScale: 2,
    thousandSeparator: ',',
    hideControls: true,
  },
};

export const FixedDecimals: Story = {
  args: {
    value: 1234.5,
    label: 'Amount (padded)',
    decimalScale: 2,
    fixedDecimalScale: true,
    hideControls: true,
  },
};
