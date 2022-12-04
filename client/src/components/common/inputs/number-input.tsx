import { ComponentProps, forwardRef, ReactElement } from 'react';
import { Input } from './input';

type Props = Omit<ComponentProps<typeof Input>, 'type'> & {
  children?: ReactElement | ReactElement[];
};

export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(props) {
  return <Input {...props} type="number" step="any" />;
});
