import { CSSProperties, MouseEventHandler } from 'react';

export interface ButtonWithLabelProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'submit' | 'button';
  style?: CSSProperties;
  target?: string;
  rel?: string;
  title?: string;
  url?: string;
  textLabel?: string;
}

export const ButtonWithLabel = ({
  title,
  url,
  style,
  target,
  textLabel,
  rel,
  type = 'button',
  onClick,
}: ButtonWithLabelProps) => {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{textLabel}</label>
      <div>
        <button
          style={style}
          type={type}
          onClick={onClick}
          className="bg-gray-100 border focus:ring-2 focus:ring-indigo-200 focus:bg-transparent hover:bg-indigo-500 hover:text-white text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out sm:text-sm rounded-md"
        >
          <a rel={rel} target={target} href={url} type={type}>
            {title}
          </a>
        </button>
      </div>
    </div>
  );
};
