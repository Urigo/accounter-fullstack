import { ComponentProps, DetailedHTMLProps, forwardRef, InputHTMLAttributes } from 'react';

import { Currency } from '../../../__generated__/types';

type CurrencyCodeProps = DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> & {
  label?: string;
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
        className="focus:ring-indigo-500 focus:border-indigo-500 h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 sm:text-sm rounded-md"
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

type Props = Omit<DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, 'type'> & {
  label?: string;
  error?: string;
  name: string;
  currencyCodeProps: ComponentProps<typeof CurrencyCodeInput>;
};

export const CurrencyInput = forwardRef<HTMLInputElement, Props>(function CurrencyInput({ label, error, ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={props.name} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="mt-1 relative rounded-md shadow-sm">
        <style>
          {`/* Chrome, Safari, Edge, Opera */
            input::-webkit-outer-spin-button,
            input::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }

            /* Firefox */
            input[type=number] {
              -moz-appearance: textfield;
            }
          `}
        </style>
        <input
          type="number"
          {...props}
          className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
        />
        <CurrencyCodeInput {...props.currencyCodeProps} />
        {error && <p className="text-red-500 text-xs italic">{error}</p>}
      </div>
    </div>
  );
});
