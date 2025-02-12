import { ReactElement } from 'react';
import { cn } from '../../lib/utils.js';
import { Button, ButtonProps } from './button.js';

export interface ActionIconProps extends Omit<ButtonProps, 'size'> {
  size?: number;
  color?: 'default' | 'blue' | 'red' | 'green' | 'gray';
}

const colorVariants = {
  default: '',
  blue: 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-500',
  red: 'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-500',
  green: 'text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-500',
  gray: 'text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-500',
};

export function ActionIcon({
  children,
  className,
  size = 30,
  color = 'default',
  variant = 'ghost',
  ...props
}: ActionIconProps): ReactElement {
  return (
    <Button
      variant={variant}
      size="icon"
      className={cn(`w-[${size}px] h-[${size}px] p-0`, colorVariants[color], className)}
      {...props}
    >
      {children}
    </Button>
  );
}
