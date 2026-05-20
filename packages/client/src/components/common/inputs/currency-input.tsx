import { forwardRef, useState, type ComponentProps } from 'react';
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
import { Label } from '../../ui/label.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.js';

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
    return (
      <div className="bottom-0 mt-6">
        {label && <Label className="sr-only">{label}</Label>}
        <Select value={value} onValueChange={onChange} disabled={disabled} name={name} form={form}>
          <SelectTrigger>
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
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
};

function CurrencySelect({
  value,
  onChange,
  onBlur,
  label,
  disabled,
  form,
}: CurrencyCodeFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-1/2 min-w-[75px] mt-6">
      {label && <Label className="sr-only">{label}</Label>}
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
            <CommandInput placeholder="Search currency..." form={form} />
            <CommandList>
              <CommandEmpty>No currency found.</CommandEmpty>
              <CommandGroup>
                {CURRENCIES.map(currency => (
                  <CommandItem
                    key={currency}
                    value={currency}
                    onSelect={() => {
                      onChange?.(currency);
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
      <CurrencySelect {...currencyCodeProps} />
    </div>
  );
});
