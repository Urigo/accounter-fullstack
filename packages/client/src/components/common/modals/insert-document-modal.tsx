import { ReactElement } from 'react';
import { CopyToClipboardButton, InsertDocument, PopUpDrawer } from '../index.js';

interface Props {
  chargeId: string;
  close: () => void;
  onChange?: () => void;
}

export const InsertDocumentModal = ({
  chargeId,
  close,
  onChange = (): void => {},
}: Props): ReactElement => {
  return (
    <PopUpDrawer
      modalSize="40%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Insert Document:</h1>
          <div className="flex flex-row gap-2">
            Charge ID: {chargeId}
            <CopyToClipboardButton
              isLink
              content={`${window.location.origin}/charges/${chargeId}`}
            />
          </div>
        </div>
      }
      opened={!!chargeId}
      onClose={close}
    >
      <InsertDocument chargeId={chargeId} closeModal={close} onChange={onChange} />
    </PopUpDrawer>
  );
};
