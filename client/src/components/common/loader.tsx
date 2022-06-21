import { Loader } from '@mantine/core';

import { Icon } from './icon';

export const AccounterLoader = () => {
  return (
    <div
      style={{
        gap: 10,
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'center',
        display: 'flex',
        marginTop: '20%',
      }}
    >
      <Icon name="logo" />
      <Loader style={{ alignSelf: 'center', display: 'flex' }} color="dark" size="xl" variant="dots" />
    </div>
  );
};
