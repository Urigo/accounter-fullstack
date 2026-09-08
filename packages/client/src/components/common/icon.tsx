import type { ComponentProps, ReactElement } from 'react';

export type IconName = 'logo';

interface IconProps extends Omit<ComponentProps<'img'>, 'src' | 'alt'> {
  name: IconName;
}

export const Icon = ({ name, ...props }: IconProps): ReactElement => {
  return <img src={`/icons/${name}.svg`} alt={name} {...props} />;
};
