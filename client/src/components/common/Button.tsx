import { Button, ButtonVariant } from '@mantine/core';
import { ReactElement, CSSProperties, FC, PropsWithChildren, MouseEventHandler } from 'react';

  
  export interface ButtonProps {
    style?: CSSProperties;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    title?: ReactElement;
    variant?: ButtonVariant;
  }
  
  export const RegularButton: FC<PropsWithChildren<ButtonProps>> = ({
    style,
    title,
    variant,
    onClick,
  }) => {
    return (
      <>
    <Button onClick={onClick} style={style} variant={variant}>
      {title}
    </Button>
      </>
    );
  };
  