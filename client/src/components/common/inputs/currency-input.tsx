import { ComponentProps, DetailedHTMLProps, forwardRef } from 'react';

import { Currency } from '../../../__generated__/types';
import { NumberInput } from './number-input';

type CurrencyCodeProps = DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const CurrencyCodeInput = forwardRef<HTMLSelectElement, CurrencyCodeProps>(function CurrencyCodeInput({
  label,
  ...props
}) {
  return (
    <div className="absolute inset-y-0 right-0 flex items-center">
      {label && (
        <label htmlFor="currency" className="sr-only">
          {label}
        </label>
      )}
      <select
        className="focus:ring-indigo-500 focus:border-indigo-500 h-full py-0 pl-2 border-transparent bg-transparent text-gray-500 sm:text-sm rounded-md"
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
});

type Props = React.ComponentProps<typeof NumberInput> & {
  error?: string;
  currencyCodeProps: ComponentProps<typeof CurrencyCodeInput>;
};

export const CurrencyInput = forwardRef<HTMLInputElement, Props>(function CurrencyInput({
  currencyCodeProps: { error: currencyError, ...currencyCodeProps },
  error,
  ...props
}) {
  return (
    <NumberInput {...props} error={error || currencyError} rightPadding="pr-12">
      <CurrencyCodeInput {...currencyCodeProps} />
    </NumberInput>
  );
});
