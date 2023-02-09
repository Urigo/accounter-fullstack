import { DocumentsToChargeMatcher } from '../../documents-to-charge-matcher';
import { PopUpDrawer } from '..';

interface Props {
  matchDocuments: string;
  setMatchDocuments: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const MatchDocumentModal = ({ matchDocuments, setMatchDocuments }: Props) => {
  return (
    <PopUpDrawer
      modalSize="80%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-5">
          <h1 className="sm:text-2xl font-small text-gray-900">Match Documents:</h1>
          <a href="/#" className="pt-1">
            Charge ID: {matchDocuments}
          </a>
        </div>
      }
      opened={!!(matchDocuments)}
      onClose={() => setMatchDocuments(undefined)}
    >
      <DocumentsToChargeMatcher
        chargeId={matchDocuments}
        onDone={() => setMatchDocuments(undefined)}
      />
    </PopUpDrawer>
  );
};
