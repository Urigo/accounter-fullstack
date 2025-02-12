import {
  ButtonHTMLAttributes,
  CSSProperties,
  DetailedHTMLProps,
  MouseEventHandler,
  ReactElement,
} from 'react';
import { Button as ShadcnButton } from '../../ui/button.js';

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
}: Props): ReactElement => {
  return (
    <ShadcnButton
      style={style}
      type={type}
      onClick={onClick}
      className="ml-auto"
      asChild={!!herf}
      {...props}
    >
      {herf ? (
        <a rel={rel} target={target} href={herf}>
          {title}
        </a>
      ) : (
        title
      )}
    </ShadcnButton>
  );
};
