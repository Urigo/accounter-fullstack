import { Image, ImageProps } from '@mantine/core';
import type { RefAttributes } from 'react';

export type IconName = 'logo';

interface IconProps extends ImageProps, RefAttributes<HTMLDivElement> {
  name: IconName;
}

export const Icon = ({ name, ...props }: IconProps) => {
  return <Image src={`/icons/${name}.svg`} {...props} />;
};
