import { CSSProperties, MouseEventHandler, ReactElement } from 'react';
import { Button } from '@mantine/core';

export interface ButtonProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  width?: string;
  disabled?: boolean;
  loading?: boolean;
  size?: number;
  type?: 'submit' | 'button';
  style?: CSSProperties;
  children?: ReactElement | ReactElement[];
}

export const ButtonImage = ({
  children,
  onClick = (): void => {
    void 0;
  },
  loading = false,
  disabled = false,
  type = 'button',
}: ButtonProps): ReactElement => {
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
