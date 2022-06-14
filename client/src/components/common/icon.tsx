import { Image, ImageProps } from '@mantine/core';

export type IconName = 'logo';

interface IconProps extends ImageProps, React.RefAttributes<HTMLDivElement> {
  name: IconName;
}

export const Icon = ({ name, ...props }: IconProps) => {
  return <Image src={`/icons/${name}.svg`} {...props} />;
};
