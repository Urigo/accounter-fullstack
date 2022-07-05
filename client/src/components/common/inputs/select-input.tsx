import { forwardRef } from 'react';

type Props = {
  label?: string;
  name?: string;
  error?: string;
  selectionEnum: { [s: number | string]: string };
};

export const SelectInput = forwardRef<HTMLSelectElement, Props>(function SelectInput({selectionEnum, label, error, ...props}, ref) {
  return <div>
  {label && (
    <label htmlFor={props.name} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
  )}
  <div className="mt-1 relative rounded-md shadow-sm">
  <select
    ref={ref}
        className="focus:ring-indigo-500 focus:border-indigo-500 h-full py-0 pl-2 border-transparent bg-transparent text-gray-500 sm:text-sm rounded-md"
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
</div>;
});
