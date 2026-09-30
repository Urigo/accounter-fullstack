import { forwardRef, useId, useState, type ComponentProps } from 'react';
import { Check, ChevronDownIcon } from 'lucide-react';
import { Currency } from '../../../gql/graphql.js';
import {
  currencyCodeToLabel,
  currencyCodeToName,
  currencyCodeToSymbol,
} from '../../../helpers/currency.js';
import { cn } from '../../../lib/utils.js';
import { usePortalContainer } from '../../../providers/portal-container.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/command.js';
import { Label } from '../../ui/label.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.js';
import { NumberInput } from './number-input.js';

const CURRENCIES = Object.values(Currency);

type CurrencyCodeProps = {
  label?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  form?: string;
};

export const CurrencyCodeInput = forwardRef<HTMLButtonElement, CurrencyCodeProps>(
  function CurrencyCodeInput({ label, value, onChange, disabled, name, form }) {
    // Portal into the surrounding modal layer when there is one — see `usePortalContainer`.
    const portalContainer = usePortalContainer();
    return (
      <div className="bottom-0 mt-6">
        {label && <Label className="sr-only">{label}</Label>}
        <Select value={value} onValueChange={onChange} disabled={disabled} name={name} form={form}>
          <SelectTrigger>
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent container={portalContainer}>
            {CURRENCIES.map(currency => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  },
);

type CurrencyCodeFieldProps = {
  name?: string;
  value?: Currency | null;
  onChange?: (value: Currency | null) => void;
  onBlur?: () => void;
  ref?: React.Ref<unknown>;
  required?: boolean;
  label?: string;
  error?: string;
  disabled?: boolean;
  form?: string;
  defaultValue?: Currency | null;
  /** Restricts the options in the dropdown. Defaults to every `Currency`. */
  currencies?: Currency[];
};

/**
 * The currency part of `CurrencyInput`, rendered inside the amount field's border.
 *
 * Collapsed, it shows only the currency symbol (`₪`, `$`, …) so it takes little room next to the
 * amount; opened, each option shows the full name, code and symbol, and all three are searchable.
 */
function CurrencySelect({
  value,
  onChange,
  onBlur,
  label = 'Currency',
  disabled,
  form,
  currencies = CURRENCIES,
}: CurrencyCodeFieldProps) {
  const [open, setOpen] = useState(false);
  // Same modal-layer workaround as `ComboBox`: the currency search input is unusable and clicks on
  // it close the surrounding drawer while the popover lives in `document.body`.
  // See `usePortalContainer` and https://github.com/emilkowalski/vaul/issues/496
  const portalContainer = usePortalContainer();

  const symbol = value ? currencyCodeToSymbol(value) : null;
  const description = value ? `${label}: ${currencyCodeToLabel(value)}` : label;

  // A locked currency is part of the value's meaning, not a control, so it renders as plain text.
  if (disabled) {
    return (
      <span
        className="flex h-full shrink-0 items-center pl-1 pr-3 text-sm text-gray-500 dark:text-gray-400"
        title={description}
        aria-label={description}
      >
        {symbol ?? '—'}
      </span>
    );
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={description}
          title={description}
          className={cn(
            'flex h-full shrink-0 items-center gap-1 rounded-r-md pl-1.5 pr-2.5 text-sm outline-none transition-colors',
            'text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-50',
            'focus-visible:bg-gray-100 dark:focus-visible:bg-gray-800',
          )}
          onBlur={onBlur}
          onClick={e => e.stopPropagation()}
        >
          <span className={cn('font-medium', !symbol && 'text-gray-500 font-normal')}>
            {symbol ?? 'Currency'}
          </span>
          <ChevronDownIcon
            strokeWidth={2}
            className="size-3.5 shrink-0 text-gray-500/80 dark:text-gray-400/80"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end" container={portalContainer}>
        <Command>
          <CommandInput placeholder="Search currency..." form={form} />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {currencies.map(currency => (
                <CommandItem
                  key={currency}
                  value={currency}
                  keywords={[currencyCodeToName(currency), currencyCodeToSymbol(currency)]}
                  onSelect={() => {
                    onChange?.(currency);
                    setOpen(false);
                  }}
                >
                  <span className="w-9 shrink-0 text-center font-medium text-gray-500 dark:text-gray-400">
                    {currencyCodeToSymbol(currency)}
                  </span>
                  <span className="truncate">{currencyCodeToLabel(currency)}</span>
                  <Check
                    className={cn('ml-auto', value === currency ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type Props = ComponentProps<typeof NumberInput> & {
  error?: string;
  currencyCodeProps: CurrencyCodeFieldProps;
  precision?: number;
};

/**
 * A single field for an amount and its currency.
 *
 * The currency picker lives inside the amount field's border (like a suffix), so the pair reads as
 * one control rather than two inputs pushed against each other. The border, focus ring and
 * invalid state belong to the wrapper and track the inner amount input.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, Props>(function CurrencyInput({
  currencyCodeProps: { error: currencyError, ...currencyCodeProps },
  error,
  label,
  id,
  className,
  ...props
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error || currencyError;
  const errorId = `${inputId}-error`;
  let { precision } = props;
  const value = Math.abs(typeof props.value === 'number' ? props.value : 0);
  if (value && !precision) {
    if (value > 0.1) {
      precision = 2;
    } else {
      for (let i = 1; i < 6; i++) {
        if (value > 10 ** -i) {
          precision = i + 1;
          break;
        }
      }
    }
  }
  const invalid = !!message || props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  // Label and error live here rather than inside `NumberInput`, so they frame the whole control
  // (amount and currency) rather than just the amount half.
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <Label htmlFor={inputId} className="mb-1">
          {label}
        </Label>
      ) : null}
      <div
        data-slot="currency-input"
        data-invalid={invalid || undefined}
        className={cn(
          'flex h-9 w-full min-w-[150px] items-stretch overflow-hidden rounded-md border border-gray-200 bg-transparent shadow-xs transition-[color,box-shadow] dark:border-gray-800 dark:bg-gray-800/30',
          'focus-within:border-gray-950 focus-within:ring-[3px] focus-within:ring-gray-950/50 dark:focus-within:border-gray-300 dark:focus-within:ring-gray-300/50',
          'data-invalid:border-red-500 data-invalid:ring-red-500/20 dark:data-invalid:border-red-900 dark:data-invalid:ring-red-900/40',
          'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
        )}
      >
        <div className="min-w-0 flex-1 [&>div]:h-full">
          <NumberInput
            className="h-full rounded-none border-0 pr-1 text-right tabular-nums bg-transparent shadow-none focus-visible:ring-0 aria-invalid:ring-0 disabled:opacity-100 dark:bg-transparent dark:dark:bg-transparent"
            {...props}
            id={inputId}
            aria-invalid={invalid}
            aria-describedby={message ? errorId : props['aria-describedby']}
            hideControls
            decimalScale={precision ?? 2}
          />
        </div>
        <CurrencySelect {...currencyCodeProps} />
      </div>
      {message ? (
        <p id={errorId} className="text-destructive mt-1 text-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
});
