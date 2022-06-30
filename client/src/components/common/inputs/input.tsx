import { ChangeEvent, DetailedHTMLProps, forwardRef, InputHTMLAttributes, PropsWithChildren } from 'react';

type Props = Omit<
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'type' | 'onChange' | 'onBlur' | 'name'
> & {
  label?: string;
  error?: string;
  name: string;
  onChange: (...event: any[]) => void;
  showControls?: boolean;
  isDirty?: boolean;
  rightPadding?: string;
  precision?: number;
  type?: 'text' | 'number';
};

export const Input = forwardRef<HTMLInputElement, PropsWithChildren<Props>>(function Input({
  type = 'text',
  label,
  error,
  onChange,
  showControls = false,
  rightPadding = 'pr-2',
  precision,
  children,
  isDirty,
  ...props
}) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    let value = Number(e.target.value);
    if (Number.isNaN(value)) {
      onChange(null);
    } else {
      if (precision) {
        const duplicator = Math.pow(10, precision);
        value = Math.round((value + Number.EPSILON) * duplicator) / duplicator;
      }
      onChange(value);
    }
  }

  return (
    <div>
      {label && (
        <label htmlFor={props.name} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="mt-1 relative rounded-md shadow-sm">
        {!showControls && type === 'number' && (
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
        )}
        <input
          type={type}
          {...props}
          onChange={type === 'number' ? handleChange : onChange}
          className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-2 ${rightPadding} sm:text-sm border-${
            error ? 'red' : isDirty ? 'green' : 'gray'
          }-300 rounded-md`}
        />
        {children}
      </div>
      {error && <p className="text-red-500 text-xs italic">{error}</p>}
    </div>
  );
});
