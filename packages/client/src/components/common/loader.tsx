import { ReactElement } from 'react';
import { Loader } from '@mantine/core';
import { Icon } from './icon.js';

export const AccounterLoader = (): ReactElement => {
  return (
    <div className="flex flex-col justify-center items-center content-center h-screen">
      <Icon name="logo" className="max-w-xs" />
      <Loader className="flex self-center" color="dark" size="xl" variant="dots" />
    </div>
  );
};
