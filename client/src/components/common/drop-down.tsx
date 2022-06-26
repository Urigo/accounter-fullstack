export interface Props {
  textLabel?: string;
  id?: string;
  name?: string;
  option: any;
}

export const DropDown = ({ textLabel, option }: Props) => {
  return (
    <div className="relative mr-4 lg:w-full xl:w-2/2 w-3/4">
      <label className="leading-7 text-sm text-gray-600">{textLabel}</label>
      <div className="relative">
        <select className="w-full bg-gray-100 rounded border bg-opacity-50 border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out">
          <option>{option}</option>
        </select>
      </div>
    </div>
  );
};
