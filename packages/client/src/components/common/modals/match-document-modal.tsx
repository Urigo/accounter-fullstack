import { ReactElement } from 'react';
import { Copy } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { PopUpDrawer } from '..';
import { writeToClipboard } from '../../../helpers';
import { DocumentsToChargeMatcher } from '../documents-to-charge-matcher';

interface Props {
  chargeId: string;
  ownerId?: string;
  setMatchDocuments: () => void;
}

export const MatchDocumentModal = ({
  chargeId,
  ownerId,
  setMatchDocuments,
}: Props): ReactElement => {
  return (
    <PopUpDrawer
      modalSize="80%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-5">
          <h1 className="sm:text-2xl font-small text-gray-900">Match Documents:</h1>
          <div className="flex flex-row gap-2">
            Charge ID: {chargeId}
            <ActionIcon
              variant="default"
              onClick={(): void => writeToClipboard(chargeId)}
              size={30}
            >
              <Copy size={20} />
            </ActionIcon>
          </div>
        </div>
      }
      opened={!!chargeId}
      onClose={(): void => setMatchDocuments()}
    >
      <DocumentsToChargeMatcher
        chargeId={chargeId}
        ownerId={ownerId}
        onDone={(): void => setMatchDocuments()}
      />
    </PopUpDrawer>
  );
};
