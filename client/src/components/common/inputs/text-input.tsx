import { ComponentProps, forwardRef, PropsWithChildren } from 'react';

import { Input } from './input';

type Props = PropsWithChildren<Omit<ComponentProps<typeof Input>, 'type' | 'showControl' | 'precision'>>;

export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(props) {
  return <Input {...props} type="text" />;
});
