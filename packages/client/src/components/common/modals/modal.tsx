import { ReactElement, ReactNode } from 'react';
import { Modal } from '@mantine/core';

export interface ModalProps {
  content?: ReactNode;
  title?: ReactElement;
  modalSize?: string;
  opened?: boolean;
  onClose?: () => void;
  children?: ReactElement | ReactElement[];
  withCloseButton?: boolean;
}

export const PopUpModal = ({
  content,
  title,
  opened = false,
  onClose = (): void => {
    return;
  },
  modalSize,
  withCloseButton = false,
}: ModalProps): ReactElement => {
  return (
    <Modal
      size={modalSize}
      opened={opened}
      onClose={onClose}
      title={title}
      withCloseButton={withCloseButton}
    >
      {content}
    </Modal>
  );
};
