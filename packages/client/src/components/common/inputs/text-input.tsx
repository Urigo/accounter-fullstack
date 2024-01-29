import { ComponentProps, forwardRef, ReactElement } from 'react';
import { Input } from './input';

type Props = Omit<ComponentProps<typeof Input>, 'type' | 'showControl' | 'precision'> & {
  children?: ReactElement | ReactElement[];
};

export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(props) {
  return <Input {...props} type="text" />;
});
