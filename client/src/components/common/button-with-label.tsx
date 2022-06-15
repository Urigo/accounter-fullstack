export interface Props {
  type?: 'submit' | 'button';
  textLabel?: string;
  textButton?: string;
  url?: string;
}

export const ButtonWithLabel = ({ type = 'button', textLabel, textButton, url }: Props) => {
  return (
    <div className="relative mr-4 lg:w-full xl:w-2/2 w-3/4">
      <label className="leading-7 text-sm text-gray-600">{textLabel}</label>
      <a
        href={url}
        target="_blank"
        type={type}
        className="w-full bg-indigo-500 rounded border bg-indigo border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
        rel="noreferrer"
      >
        {textButton}
      </a>
    </div>
  );
};
