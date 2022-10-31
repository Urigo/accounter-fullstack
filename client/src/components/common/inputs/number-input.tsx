import { ComponentProps, forwardRef, PropsWithChildren } from 'react';

import { Input } from './input';

type Props = PropsWithChildren<Omit<ComponentProps<typeof Input>, 'type'>>;

export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(props) {
  return <Input {...props} type="number" step="any" />;
});
