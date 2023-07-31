import { ButtonHTMLAttributes, CSSProperties, DetailedHTMLProps, MouseEventHandler } from 'react';

export interface Props
  extends DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  herf?: string;
  type?: 'submit' | 'button';
  style?: CSSProperties;
  target?: string;
  rel?: string;
  title?: string;
  url?: string;
}

export const Button = ({
  title,
  herf,
  style,
  target,
  rel,
  type = 'button',
  onClick,
  ...props
}: Props) => {
  return (
    <button
      style={style}
      type={type}
      onClick={onClick}
      className="cursor: pointer text-align: center flex ml-auto text-white bg-indigo-500 border-0 py-1.5 px-3 focus:outline-none hover:bg-indigo-600 rounded;"
      {...props}
    >
      <a rel={rel} target={target} href={herf} type={type}>
        {title}
      </a>
    </button>
  );
};
