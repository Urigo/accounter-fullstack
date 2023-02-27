import { ComponentProps } from 'react';
import { NumberInput } from './number-input';

type Props = ComponentProps<typeof NumberInput>;

export function PercentageInput({ ...props }: Props) {
  // convert 0-1 to 0-100
  if (props.value != null && !Number.isNaN(props.value)) {
    props.value = (props.value as number) * 100;
  }
  if (props.onChange) {
    const temp = props.onChange;
    props.onChange = (e: unknown) => {
      if (!Number.isNaN(e)) {
        e = (e as number) / 100;
      }
      temp(e);
    };
  }

  return (
    <NumberInput {...props} rightPadding="pr-5">
      <p className="absolute inset-y-0 right-0 pr-1 flex items-center">%</p>
    </NumberInput>
  );
}
