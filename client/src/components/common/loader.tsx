import { Loader } from '@mantine/core';
import { Icon } from './icon';

export const AccounterLoader = () => {
  return (
    <div className="flex flex-col justify-center items-center gap-10">
      <Icon name="logo" className="max-w-xs" />
      <Loader className="flex self-center" color="dark" size="xl" variant="dots" />
    </div>
  );
};
