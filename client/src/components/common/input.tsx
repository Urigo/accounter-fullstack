import { ComponentProps, ReactElement } from 'react';
import clsx from 'clsx';

export const Input = ({
  className,
  error,
  label,
  inputId,
  inputName,
  labelHtmlFor,
  placeholder,
  ...props
}: ComponentProps<'input'> & {
  error?: string;
  label?: string;
  labelHtmlFor?: string;
  placeholder?: string;
  inputName?: string;
  inputId?: string;
}): ReactElement => {
  return (
    <div className="col-span-6 sm:col-span-3">
      <label htmlFor={labelHtmlFor} className="block text-sm font-medium text-black-500">
        {label}
      </label>
      <input
        id={inputId}
        name={inputName}
        placeholder={placeholder}
        className={clsx(
          `
          w-full
          rounded-xl
          border
          py-3
          px-4
          font-medium
          placeholder:text-black-500
          focus:ring-1
          disabled:cursor-not-allowed
          disabled:opacity-30
          `,
          error
            ? 'border-red-500  bg-gray-200 focus:ring-black-500'
            : 'border-transparent bg-gray-200 focus:border-black-800',
          className
        )}
        {...props}
      />
    </div>
  );
};
