import {
  forwardRef,
  useState,
  type ComponentProps,
  type DetailedHTMLProps,
  type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDownIcon } from 'lucide-react';
import { NumberInput } from '@mantine/core';
import { Currency } from '../../../gql/graphql.js';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/button.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/command.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';

const CURRENCIES = Object.values(Currency);

type CurrencyCodeProps = DetailedHTMLProps<
  SelectHTMLAttributes<HTMLSelectElement>,
  HTMLSelectElement
> & {
  label?: string;
  error?: string;
};

export const CurrencyCodeInput = forwardRef<HTMLSelectElement, CurrencyCodeProps>(
  function CurrencyCodeInput({ label, ...props }) {
    return (
      <div className="bottom-0 mt-6">
        {label && (
          <label htmlFor="currency" className="sr-only">
            {label}
          </label>
        )}
        <select
          className="bg-gray-100 border focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-hidden text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out sm:text-sm rounded-md"
          {...props}
        >
          {Object.keys(Currency).map(key => (
            <option key={key} value={Currency[key as keyof typeof Currency]}>
              {Currency[key as keyof typeof Currency]}
            </option>
          ))}
        </select>
      </div>
    );
  },
);

type CurrencyCodeFieldProps = {
  name?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  ref?: React.Ref<unknown>;
  required?: boolean;
  label?: string;
  error?: string;
  disabled?: boolean;
};

function CurrencySelect({
  value,
  onChange,
  onBlur,
  label,
  error,
  disabled,
}: CurrencyCodeFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-1/2 min-w-[75px] mt-6">
      {label && <span className="sr-only">{label}</span>}
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            disabled={disabled}
            onBlur={onBlur}
            onClick={e => e.stopPropagation()}
          >
            <span>{value ?? 'Currency'}</span>
            <ChevronDownIcon
              strokeWidth={2}
              className="shrink-0 text-gray-500/80 dark:text-gray-400/80 size-4"
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search currency..." />
            <CommandList>
              <CommandEmpty>No currency found.</CommandEmpty>
              <CommandGroup>
                {CURRENCIES.map(currency => (
                  <CommandItem
                    key={currency}
                    value={currency}
                    onSelect={val => {
                      const selected =
                        CURRENCIES.find(c => c.toLowerCase() === val.toLowerCase()) ?? null;
                      onChange?.(selected);
                      setOpen(false);
                    }}
                  >
                    {currency}
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
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

type Props = ComponentProps<typeof NumberInput> & {
  error?: string;
  currencyCodeProps: CurrencyCodeFieldProps;
  precision?: number;
};

export const CurrencyInput = forwardRef<HTMLInputElement, Props>(function CurrencyInput({
  currencyCodeProps: { error: currencyError, ...currencyCodeProps },
  error,
  ...props
}) {
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
  return (
    <div className="w-full flex flex-row min-w-[150px]">
      <NumberInput
        className="w-full min-w-[75px]"
        {...props}
        hideControls
        precision={precision ?? 2}
        error={error || currencyError}
      />
      <CurrencySelect {...currencyCodeProps} error={currencyError} />
    </div>
  );
});
