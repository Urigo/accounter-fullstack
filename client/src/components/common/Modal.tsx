import { CSSProperties, FC, PropsWithChildren, ReactElement } from 'react';
import { Modal, Button, Group } from '@mantine/core';

export interface ModalProps {
  ButtonDisplay?: ReactElement;
  style?: CSSProperties;
  content?: ReactElement;
  title?: ReactElement;
  modalSize?: string;
  opened?: any;
  onClose?: any;
  onClickInsideButton?: any;
}

export const PopUpModal: FC<PropsWithChildren<ModalProps>> = ({ content, title, opened, onClose, modalSize }) => {
  return (
    <>
      <Modal size={modalSize} opened={opened} onClose={onClose} title={title}>
        {content}
      </Modal>
    </>
  );
};
