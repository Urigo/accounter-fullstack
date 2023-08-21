import {
  ChangeEvent,
  DetailedHTMLProps,
  forwardRef,
  InputHTMLAttributes,
  ReactElement,
} from 'react';

type Props = Omit<
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'type' | 'onChange' | 'onBlur' | 'name'
> & {
  label?: string;
  error?: string;
  name: string;
  onChange: (...event: unknown[]) => void;
  showControls?: boolean;
  isDirty?: boolean;
  rightPadding?: string;
  precision?: number;
  type?: 'text' | 'number';
  className?: string;
  children?: ReactElement | ReactElement[];
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input({
  type = 'text',
  label,
  error,
  onChange,
  showControls = false,
  rightPadding = 'pr-2',
  precision,
  children,
  isDirty,
  className,
  ...props
}) {
  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
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
    <div className={className}>
      {label && (
        <label htmlFor={props.name} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div>
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
          className={`w-full bg-gray-100 rounded border border-${
            error ? 'red' : isDirty ? 'green' : 'gray'
          }-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out  ${rightPadding} sm:text-sm rounded-md`}
        />
        {children}
      </div>
      {error && <p className="text-red-500 text-xs italic">{error}</p>}
    </div>
  );
});
