import { Button } from '@mantine/core';
import { CSSProperties, PropsWithChildren, MouseEventHandler, FC } from 'react';

export interface ButtonProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  width?: string;
  disabled?: boolean;
  loading?: boolean;
  size?: number;
  type?: 'submit' | 'button';
  style?: CSSProperties;
}

export const ButtonImage: FC<PropsWithChildren<ButtonProps>> = ({
  children,
  onClick = () => {
    void 0;
  },
  loading = false,
  disabled = false,
  type = 'button',
}) => {
  const buttonDisabled = disabled || loading;

  return (
    <Button
      type={type}
      disabled={buttonDisabled}
      onClick={onClick}
      style={{ width: 100, height: 100, backgroundColor: 'transparent', cursor: 'pointer' }}
    >
      {children}
    </Button>
  );
};
