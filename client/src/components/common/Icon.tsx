/* eslint @typescript-eslint/sort-type-union-intersection-members: error */
import { FC } from 'react';
import { Image } from '@mantine/core';

export type IconName = 'logo';

interface IconProps {
  width?: number | string;
  height?: number | string;
  name: IconName;
}

export const Icon: FC<IconProps> = ({ name, height, width }) => {
  return <Image src={`/icons/${name}.svg`} height={height} width={width} />;
};
