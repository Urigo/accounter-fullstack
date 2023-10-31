import type { ReactElement, RefAttributes } from 'react';
import { Image, ImageProps } from '@mantine/core';

export type IconName = 'logo';

interface IconProps extends ImageProps, RefAttributes<HTMLImageElement> {
  name: IconName;
}

export const Icon = ({ name, ...props }: IconProps): ReactElement => {
  return <Image src={`/icons/${name}.svg`} {...props} />;
};
