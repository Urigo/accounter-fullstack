import { CSSProperties, MouseEventHandler, ReactElement } from 'react';
import { Button } from '../../ui/button.js';

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
}: ButtonWithLabelProps): ReactElement => {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{textLabel}</label>
      <div>
        <Button
          style={style}
          type={type}
          onClick={onClick}
          variant="outline"
          className="w-full"
          asChild={!!url}
        >
          {url ? (
            <a rel={rel} target={target} href={url}>
              {title}
            </a>
          ) : (
            title
          )}
        </Button>
      </div>
    </div>
  );
};
