import { useEffect, useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Currency } from '../../../gql/graphql.js';
import { CurrencyInput } from './currency-input.js';

/**
 * The amount field and the currency select must sit on the same baseline.
 *
 * They used to be aligned by an `mt-6` spacer on the select, sized to the height of Mantine's
 * label. Replacing the number field changed that height and the two halves drifted apart, so
 * the label now lives on the wrapper and the two controls are direct flex siblings. These
 * stories exist to make that alignment visible.
 */
function Harness({
  value: initialValue,
  currency: initialCurrency = Currency.Ils,
  ...props
}: {
  value?: number;
  currency?: Currency;
  label?: string;
  error?: string;
}): ReactElement {
  const [value, setValue] = useState<number | undefined>(initialValue);
  const [currency, setCurrency] = useState<Currency | null>(initialCurrency);

  useEffect(() => setValue(initialValue), [initialValue]);

  return (
    <div className="w-96 p-6">
      <CurrencyInput
        {...props}
        value={value}
        onChange={next => setValue(typeof next === 'number' ? next : undefined)}
        currencyCodeProps={{ value: currency, onChange: setCurrency, label: 'Currency' }}
      />
    </div>
  );
}

const meta = {
  title: 'Inputs/CurrencyInput',
  component: Harness,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The common case — 25 of the 27 call sites pass a label. */
export const WithLabel: Story = { args: { value: 1250.5, label: 'Base salary' } };

/** No label: the two controls still share a baseline, with nothing above them. */
export const WithoutLabel: Story = { args: { value: 1250.5 } };

/** The error sits below both controls, so it cannot push them out of alignment. */
export const WithError: Story = {
  args: { value: 0, label: 'Amount', error: 'Must be greater than zero' },
};

/** A long label wraps above the row without displacing the select. */
export const LongLabel: Story = {
  args: { value: 42, label: 'Travel and subsistence reimbursement for the reporting period' },
};
