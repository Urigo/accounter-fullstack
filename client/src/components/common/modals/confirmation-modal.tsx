import { ReactElement } from 'react';
import { Modal, ModalProps } from '@mantine/core';

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
            <button
              onClick={props.onClose}
              className="flex mt-6 text-white bg-red-500 border-0 py-2 px-5 focus:outline-none hover:bg-red-600 rounded"
            >
              {labels.cancel}
            </button>
            <button
              onClick={onConfirm}
              className="flex mt-6 text-white bg-indigo-500 border-0 py-2 px-5 focus:outline-none hover:bg-indigo-600 rounded"
            >
              {labels.confirm}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
