import { ComponentProps, DetailedHTMLProps, forwardRef, SelectHTMLAttributes } from 'react';
import { Currency } from '../../../gql/graphql.js';
import { NumberInput } from './number-input';

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
          className="bg-gray-100 border focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out sm:text-sm rounded-md"
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

type Props = React.ComponentProps<typeof NumberInput> & {
  error?: string;
  currencyCodeProps: ComponentProps<typeof CurrencyCodeInput>;
  precision?: number;
};

export const CurrencyInput = forwardRef<HTMLInputElement, Props>(function CurrencyInput({
  currencyCodeProps: { error: currencyError, ...currencyCodeProps },
  error,
  ...props
}) {
  return (
    <div>
      <div className="w-full flex flex-row ">
        <NumberInput
          className="w-full"
          {...props}
          precision={props.precision ?? 2}
          error={error || currencyError}
        />
        <CurrencyCodeInput {...currencyCodeProps} />
      </div>
    </div>
  );
});
