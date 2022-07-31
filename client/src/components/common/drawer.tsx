import { Drawer, DrawerProps } from '@mantine/core';
import { PropsWithChildren, ReactElement } from 'react';

export interface Props extends DrawerProps {
  modalSize?: string;
}

export const PopUpDrawer = ({
  children,
  withOverlay = false,
  withCloseButton = true,
  lockScroll = false,
  opened = false,
  onClose = () => null,
  modalSize,
  ...props
}: PropsWithChildren<Props>): ReactElement => {
  return (
    <Drawer
      className="overflow-y-auto outline outline-2 outline-indigo-300"
      lockScroll={lockScroll}
      withCloseButton={withCloseButton}
      withOverlay={withOverlay}
      opened={opened}
      onClose={onClose}
      size={modalSize}
      {...props}
    >
      {children}
    </Drawer>
  );
};
