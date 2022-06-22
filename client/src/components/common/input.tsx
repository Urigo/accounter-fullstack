import { forwardRef, HTMLInputTypeAttribute, HTMLProps } from 'react';

export type InputProps = HTMLProps<HTMLInputElement> & {
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  name?: string;
  id?: string;
  textLabel?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  type,
  placeholder,
  name,
  id,
  textLabel,
}) {
  return (
    <div className="relative mr-4 lg:w-full xl:w-2/2 w-3/4">
      <label className="leading-7 text-sm text-gray-600">{textLabel}</label>
      <input
        type={type}
        id={id}
        placeholder={placeholder}
        name={name}
        className="w-full bg-gray-100 rounded border bg-opacity-50 border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
      />
    </div>
  );
});
