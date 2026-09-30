import { useEffect, useState, type ReactElement } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Currency } from '../../../gql/graphql.js';
import { FIAT_CURRENCIES } from '../../../helpers/currency.js';
import { Label } from '../../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.js';
import { CurrencyInput } from './currency-input.js';

/**
 * One field for an amount and its currency.
 *
 * The currency picker sits inside the amount field's border, so the pair reads as a single control
 * rather than two inputs pushed against each other. Collapsed, it shows only the currency symbol;
 * opened, every option lists name, code and symbol, and all three are searchable.
 */
function Harness({
  value: initialValue,
  currency: initialCurrency = Currency.Ils,
  currencyDisabled,
  currencies,
  ...props
}: {
  value?: number;
  currency?: Currency | null;
  currencyDisabled?: boolean;
  currencies?: Currency[];
  label?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}): ReactElement {
  const [value, setValue] = useState<number | undefined>(initialValue);
  const [currency, setCurrency] = useState<Currency | null>(initialCurrency);

  useEffect(() => setValue(initialValue), [initialValue]);
  useEffect(() => setCurrency(initialCurrency), [initialCurrency]);

  return (
    <div className="w-80 p-6">
      <CurrencyInput
        {...props}
        value={value}
        onChange={next => setValue(typeof next === 'number' ? next : undefined)}
        currencyCodeProps={{
          value: currency,
          onChange: setCurrency,
          label: 'Currency',
          disabled: currencyDisabled,
          currencies,
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Inputs/CurrencyInput',
  component: Harness,
  parameters: { layout: 'centered' },
  argTypes: {
    currency: { control: 'select', options: Object.values(Currency) },
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The common case: an amount with a selectable currency, shown as its symbol. */
export const Default: Story = { args: { value: 2562.56, label: 'Amount' } };

/** Opens the dropdown: each option shows symbol, name and code. */
export const Opened: Story = {
  args: { value: 2562.56, label: 'Amount', currency: Currency.Usd },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /currency/i }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('US Dollar (USD)')).toBeVisible();
  },
};

/** Typing in the dropdown's search matches the name, the code or the symbol. */
export const SearchBySymbol: Story = {
  args: { value: 100, label: 'Amount' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /currency/i }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByPlaceholderText('Search currency...'), '€');
    await expect(await body.findByText('Euro (EUR)')).toBeVisible();
  },
};

/** Restricted options — the issue-document forms only offer fiat currencies. */
export const FiatOnly: Story = {
  args: { value: 1250.5, label: 'Price', currency: Currency.Eur, currencies: FIAT_CURRENCIES },
};

/** Crypto currencies have no symbol of their own, so the code is shown instead. */
export const Crypto: Story = {
  args: { value: 0.00421, label: 'Amount', currency: Currency.Eth },
};

/** A locked currency (e.g. VAT follows the document amount) renders as plain text. */
export const LockedCurrency: Story = {
  args: { value: 2562.56, label: 'VAT', currencyDisabled: true },
};

/** No currency picked yet. */
export const NoCurrency: Story = {
  args: { label: 'Amount', currency: null, placeholder: '0.00' },
};

/** No label: nothing is rendered above the field. */
export const WithoutLabel: Story = { args: { value: 1250.5 } };

/** The error sits below the whole control, and the border turns red. */
export const WithError: Story = {
  args: { value: 0, label: 'Amount', error: 'Must be greater than zero' },
};

/** The whole control is disabled. */
export const Disabled: Story = {
  args: { value: 1250.5, label: 'Amount', disabled: true, currencyDisabled: true },
};

/** A long label wraps above the field without affecting it. */
export const LongLabel: Story = {
  args: { value: 42, label: 'Travel and subsistence reimbursement for the reporting period' },
};

/**
 * Side by side with a regular shadcn select, as in the payment form: the combined field matches
 * its height and border.
 */
export const InFormRow: Story = {
  render: function InFormRow() {
    const [amount, setAmount] = useState<number | undefined>(2562.56);
    const [currency, setCurrency] = useState<Currency | null>(Currency.Ils);
    return (
      <div className="grid w-xl grid-cols-3 gap-4 p-6">
        <div className="space-y-2">
          <Label>Payment Type</Label>
          <Select defaultValue="wire">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wire">Wire Transfer</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="in-form-row-amount">Amount</Label>
          <CurrencyInput
            id="in-form-row-amount"
            value={amount}
            onChange={next => setAmount(typeof next === 'number' ? next : undefined)}
            currencyCodeProps={{ value: currency, onChange: setCurrency }}
          />
        </div>
      </div>
    );
  },
};
