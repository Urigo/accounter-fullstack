import { ReactElement } from 'react';
import { Modal, ModalProps } from '@mantine/core';
import { Button } from '../../ui/button.js';

interface Props extends ModalProps {
  labels?: { cancel?: string; confirm?: string };
  onConfirm: () => void;
  children?: ReactElement | ReactElement[];
}

export function ConfirmationModal({
  labels = { cancel: 'Cancel', confirm: 'Confirm' },
  title,
  onConfirm,
  children,
  ...props
}: Props): ReactElement {
  return (
    <Modal closeOnEscape withCloseButton={false} {...props}>
      <div className="flex flex-wrap -mx-4 -mb-10 text-center">
        <div className="mb-10 px-4">
          {title && (
            <h3 className="title-font text-2xl font-medium text-gray-900 mt-6 mb-3">{title}</h3>
          )}
          {children}
          <div className="flex mx-auto flex-row justify-evenly">
            <Button onClick={props.onClose} variant="destructive" className="mt-6">
              {labels.cancel}
            </Button>
            <Button onClick={onConfirm} className="mt-6">
              {labels.confirm}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
