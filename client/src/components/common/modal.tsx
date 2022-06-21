import { Modal } from '@mantine/core';
import { CSSProperties, PropsWithChildren, ReactElement, ReactNode } from 'react';

export interface ModalProps {
  ButtonDisplay?: ReactElement;
  style?: CSSProperties;
  content?: ReactNode;
  title?: ReactElement;
  modalSize?: string;
  opened?: boolean;
  onClose?: () => void;
}

export const PopUpModal = ({
  content,
  title,
  opened = false,
  onClose = () => null,
  modalSize,
}: PropsWithChildren<ModalProps>): ReactElement => {
  return (
    <Modal size={modalSize} opened={opened} onClose={onClose} title={title}>
      {content}
    </Modal>
  );
};
