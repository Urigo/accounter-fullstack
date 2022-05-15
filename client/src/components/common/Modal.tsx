import {
  CSSProperties,
  FC,
  MouseEventHandler,
  PropsWithChildren,
  ReactElement,
  useState,
} from 'react';
import { Modal, Button, Group } from '@mantine/core';

export interface ModalProps {
  ButtonDisplay?: ReactElement;
  style?: CSSProperties;
  content?: ReactElement;
  title?: ReactElement;
  modalSize?: string;
}

export const PopUpModal: FC<PropsWithChildren<ModalProps>> = ({
  ButtonDisplay,
  content,
  title,
  modalSize,
}) => {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Modal
      size={modalSize}
        opened={opened}
        onClose={() => setOpened(false)}
        title={title}
      >
        {content}
      </Modal>

      <Group  position="center">
        <Button
          style={{  backgroundColor: 'transparent', height: 100, width: 100 }}
          onClick={() => setOpened(true)}
        >
          {ButtonDisplay}
        </Button>
      </Group>
    </>
  );
};
