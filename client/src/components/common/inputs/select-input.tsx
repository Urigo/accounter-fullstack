import { forwardRef } from 'react';

type Props = {
  label?: string;
  name?: string;
  error?: string;
  selectionEnum: { [s: number | string]: string };
};

export const SelectInput = forwardRef<HTMLSelectElement, Props>(function SelectInput(
  { selectionEnum, label, error, ...props },
  ref
) {
  return (
    <div>
      {label && (
        <label htmlFor={props.name} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div>
        <select
          ref={ref}
          className={` bg-gray-100 border border-${
            error ? 'red' : 'gray'
          }-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out block sm:text-sm rounded-md`}
          {...props}
        >
          {Object.keys(selectionEnum).map(key => (
            <option key={key} value={selectionEnum[key as keyof typeof selectionEnum]}>
              {selectionEnum[key as keyof typeof selectionEnum]}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-red-500 text-xs italic">{error}</p>}
    </div>
  );
});
