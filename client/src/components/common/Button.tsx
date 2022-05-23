import { Button, ButtonVariant } from '@mantine/core';
import { ReactElement, CSSProperties, PropsWithChildren, MouseEventHandler } from 'react';

export interface ButtonProps {
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  title?: ReactElement;
  variant?: ButtonVariant;
}

export const RegularButton = ({ style, title, variant, onClick }: PropsWithChildren<ButtonProps>) => {
  return (
    <>
      <Button onClick={onClick} style={style} variant={variant}>
        {title}
      </Button>
    </>
  );
};
