import { forwardRef, HTMLInputTypeAttribute, HTMLProps, ReactNode } from 'react';

export type InputProps = HTMLProps<HTMLInputElement> & {
  type?: HTMLInputTypeAttribute;
  onClick?: () => void;
  labelTitle?: string;
  currencySymbol?: string | ReactNode;
  dropDownOptions?: string | ReactNode;
  id?: string;
  name?: string;
  inputId?: string;
  inputName?: string;
  placeholder?: string | number | undefined;
  htmlFor?: string;
  selectId?: string;
  selectName?: string;
};

export const InputDropDown = forwardRef<HTMLInputElement, InputProps>(function Input({
  type = 'text',
  labelTitle,
  dropDownOptions,
  inputId,
  inputName,
  placeholder,
  htmlFor,
  selectId,
  selectName,
}) {
  return (
    <div className="relative mr-4 md:w-full lg:w-full ">
      <label htmlFor={htmlFor} className="leading-7 text-sm text-gray-600">
        {labelTitle}
      </label>
      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          type={type}
          name={inputName}
          id={inputId}
          className="w-full bg-gray-100 rounded border bg-opacity-50 border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
          placeholder={placeholder}
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
          <select
            id={selectId}
            name={selectName}
            className="focus:ring-indigo-500 focus:border-indigo-500 h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 sm:text-sm rounded-md"
          >
            <option>{dropDownOptions}</option>
          </select>
        </div>
      </div>
    </div>
  );
});
