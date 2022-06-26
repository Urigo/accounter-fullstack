import { forwardRef, HTMLInputTypeAttribute, HTMLProps } from 'react';

export type InputProps = HTMLProps<HTMLInputElement> & {
  type?: HTMLInputTypeAttribute;
  onClick?: () => void;
  labelTitle?: string;
  id?: string;
  name?: string;
  inputId?: string;
  inputName?: string;
  placeholder?: string;
  htmlFor?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  type = 'text',
  labelTitle,
  inputId,
  inputName,
  placeholder,
  htmlFor,
}) {
  return (
    <div className="relative mr-4 md:w-full lg:w-full ">
      <label htmlFor={htmlFor} className="leading-7 text-sm text-gray-600">
        {labelTitle}
      </label>
      <input
        type={type}
        name={inputName}
        id={inputId}
        placeholder={placeholder}
        className="w-full bg-gray-100 rounded border bg-opacity-50 border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
      />
    </div>
  );
});
