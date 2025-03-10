import { ComponentProps, DetailedHTMLProps, forwardRef, SelectHTMLAttributes } from 'react';
import { NumberInput, Select } from '@mantine/core';
import { Currency } from '../../../gql/graphql.js';

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

type Props = ComponentProps<typeof NumberInput> & {
  error?: string;
  currencyCodeProps: Omit<ComponentProps<typeof Select>, 'data'>;
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
      <Select
        className="w-1/2 min-w-[75px]"
        {...currencyCodeProps}
        data={Object.keys(Currency).map(key => Currency[key as keyof typeof Currency])}
      />
    </div>
  );
});
