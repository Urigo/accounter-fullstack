import { ComponentProps } from 'react';

import { NumberInput } from './number-input';

type Props = ComponentProps<typeof NumberInput>;

export function PercentageInput(props: Props) {
  return (
    <NumberInput {...props} rightPadding="pr-5">
      <p className="absolute inset-y-0 right-0 pr-1 flex items-center">%</p>
    </NumberInput>
  );
}
