import { Drawer } from '@mantine/core';
import { CSSProperties, PropsWithChildren, ReactElement, ReactNode } from 'react';

export interface Props {
  ButtonDisplay?: ReactElement;
  style?: CSSProperties;
  content?: ReactNode;
  title?: ReactElement;
  modalSize?: string;
  opened?: boolean;
  padding?: number;
  onClose?: () => void;
  position?: 'left' | 'right' | 'top' | 'bottom';
  withOverlay?: boolean;
  withCloseButton?: boolean;
  lockScroll?: boolean;
}

export const PopUpDrawer = ({
  content,
  position,
  title,
  withOverlay = false,
  withCloseButton = true,
  lockScroll = false,
  opened = false,
  onClose = () => null,
  padding,
  modalSize,
}: PropsWithChildren<Props>): ReactElement => {
  return (
    <Drawer
      className="overflow-y-auto outline outline-2 outline-indigo-300"
      lockScroll={lockScroll}
      withCloseButton={withCloseButton}
      withOverlay={withOverlay}
      position={position}
      opened={opened}
      onClose={onClose}
      title={title}
      padding={padding}
      size={modalSize}
    >
      {content}
    </Drawer>
  );
};
