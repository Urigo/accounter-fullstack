import { CSSProperties, MouseEventHandler } from 'react';

export interface Props {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'submit' | 'button';
  style?: CSSProperties;
  target?: string;
  rel?: string;
  title?: string;
  url?: string;
  textLabel?: string;
}

export const ButtonWithLabel = ({ title, url, style, target, textLabel, rel, type = 'button', onClick }: Props) => {
  return (
    <div className="relative mr-4 lg:w-full xl:w-2/2 w-3/4">
      <label className="leading-7 text-sm text-gray-600">{textLabel}</label>
      <button
        style={style}
        type={type}
        onClick={onClick}
        className="w-full bg-indigo-500 rounded border bg-indigo border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
      >
        <a rel={rel} target={target} href={url} type={type}>
          {title}
        </a>
      </button>
    </div>
  );
};
