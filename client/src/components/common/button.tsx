import { CSSProperties, MouseEventHandler } from 'react';

export interface ButtonProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  width?: string;
  disabled?: boolean;
  loading?: boolean;
  size?: number;
  type?: 'submit' | 'button';
  style?: CSSProperties;
  target?: string;
  herf?: string;
  rel?: string;
  title?: string;
}

export const AccounterButton = ({
  title,
  type = 'button',
  onClick = () => {
    void 0;
  },
}: ButtonProps) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className="cursor: pointer text-align: center flex ml-auto text-white bg-indigo-500 border-0 py-1.5 px-3 focus:outline-none hover:bg-indigo-600 rounded;"
    >
      {title}
    </button>
  );
};
