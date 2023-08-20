import { CSSProperties, ReactElement, ReactNode } from 'react';
import { Modal } from '@mantine/core';

export interface ModalProps {
  ButtonDisplay?: ReactElement;
  style?: CSSProperties;
  content?: ReactNode;
  title?: ReactElement;
  modalSize?: string;
  opened?: boolean;
  onClose?: () => void;
  children?: ReactElement | ReactElement[];
}

export const PopUpModal = ({
  content,
  title,
  opened = false,
  onClose = (): void => {
    return;
  },
  modalSize,
}: ModalProps): ReactElement => {
  return (
    <Modal size={modalSize} opened={opened} onClose={onClose} title={title}>
      {content}
    </Modal>
  );
};
